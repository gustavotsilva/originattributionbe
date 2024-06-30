import dotenv from 'dotenv';
dotenv.config();

import { SentryError, sentryLog } from './sentry.js'
import express from 'express';
import { MongoClient, ServerApiVersion } from 'mongodb';
const cors = require('cors');

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

app.post('/pulse', async (req, res) => {
    const requestBody = req.body;
    const response = {}
    try {
      const collection = (await connectToDatabase()).collection('pulse_heartbeat');
      await collection.insertOne(requestBody);
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

const port = parseInt(process.env.PORT);
app.listen(port, () => {
  console.log(`listening on port ${port}`);
});