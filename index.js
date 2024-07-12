import dotenv from 'dotenv';
dotenv.config();

import { SentryError, sentryLog } from './sentry.js'
import express from 'express';
import { MongoClient, ServerApiVersion } from 'mongodb';
import cors from 'cors';
import { getMatchingConfidence } from './matching.js';

const app = express();
app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_CONNECTION;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) return cachedDb;
    await client.connect();
    const db = client.db('pulse_attribution');
    return (cachedDb = db);
}

async function findPulse(collection, ipAddress) {
    const filter = { 'pulse.ipAddress': ipAddress };
    const sorting = { 'pulse.timestampUTC': -1 };
    return await collection.find(filter).sort(sorting).limit(5).toArray()
}

async function findDuplicated(collection, ipAddress, uuid, originMemberID, event, eventDetails) {
  const filter = { 'pulse.ipAddress': ipAddress, 'pulse.uuid': uuid, 'pulse.originMemberID': originMemberID, 'event': event, 'eventDetails': eventDetails };
  return await collection.find(filter).toArray()
}

function validPageViewPulse(pulseEvent){
  if(pulseEvent.event != 'page_view') return true;
  if(!pulseEvent.pulse.markers && !pulseEvent.pulse.genericUTM) return false;
  return true;
}

app.post('/pulse', async (req, res) => {
    const requestBody = req.body;
    const response = {}
    try {
      if(validPageViewPulse(requestBody)){
        const collection = (await connectToDatabase()).collection('pulse_heartbeat');
        const duplicated = await findDuplicated(collection, requestBody.pulse.ipAddress, requestBody.pulse.uuid, requestBody.pulse.originMemberID, requestBody.event, requestBody.eventDetails);
        if(!duplicated?.length) await collection.insertOne(requestBody);
      }
      response.code = 200;
      response.message = 'Data saved successfully';
      sentryLog(SentryError.INFO, requestBody, response.message);
    } catch (error) {
      response.code = 500;
      response.message = `Failed to save data - ${error.message}`;
      sentryLog(SentryError.INCIDENT, requestBody, error);
    }
    res.status(response.code).json({ message: response.message });
});

app.post('/match', async (req, res) => {
  const requestBody = req.body;
  const response = {};
  try {
    const pulse_client = requestBody;
    const collection = (await connectToDatabase()).collection('pulse_heartbeat');
    const heartbeats = await findPulse(collection, pulse_client.ipAddress);
    const matchedPulse = {};
    if(heartbeats?.length) {
      const highestConfidencePulse = heartbeats.reduce((a, b) => {
        const confidenceA = getMatchingConfidence(a.pulse, pulse_client);
        const confidenceB = getMatchingConfidence(b.pulse, pulse_client);
        const latestPulse = a.pulse.timestampUTC > b.pulse.timestampUTC ? a : b;
        return confidenceA > confidenceB ? a : (confidenceA == confidenceB ? latestPulse : b);
      });
      const highestConfidenceScore = getMatchingConfidence(highestConfidencePulse.pulse, pulse_client);
      if(highestConfidenceScore) {
        matchedPulse.confidence = highestConfidenceScore;
        matchedPulse.pulse = highestConfidencePulse.pulse;
      }
    }
    response.code = 200;
    response.message = matchedPulse;
    sentryLog(SentryError.INFO, requestBody, 'Pulse matched successfully');
  } catch (error) {
    response.code = 500;
    response.message = `Failed to match - ${error.message}`;
    sentryLog(SentryError.INCIDENT, requestBody, error);
  }
  res.status(response.code).json((response.code === 200 ? response.message : { message: response.message }));
});

const port = parseInt(process.env.PORT);
app.listen(port, () => {
  console.log(`listening on port ${port}`);
});