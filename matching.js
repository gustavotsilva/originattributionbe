const getSecondsBetweenTimestamps = (timestamp1, timestamp2) =>
    (Math.abs((new Date(timestamp1)) - (new Date(timestamp2)))/1000);
 
 function deviceMatchingScore(pulse_db, pulse_client, scorePerc){
   let score = 0;
   if(pulse_client.deviceDetails.os                === pulse_db.deviceDetails.os)                score += scorePerc;
   if(pulse_client.deviceDetails.screenResolution  === pulse_db.deviceDetails.screenResolution)  score += scorePerc;
   return score;
 }
 
 export function getMatchingConfidence(pulse_db, pulse_client){
   const secondsInBetween = getSecondsBetweenTimestamps(pulse_client.timestampUTC, pulse_db.timestampUTC);
         if(secondsInBetween <= 180)  return Number(0.98 + deviceMatchingScore(pulse_db, pulse_client, 0.01)).toFixed(2);  //max: 100%
   else  if(secondsInBetween <= 300)  return Number(0.95 + deviceMatchingScore(pulse_db, pulse_client, 0.01)).toFixed(2);  //max: 97%
   else  if(secondsInBetween <= 600)  return Number(0.90 + deviceMatchingScore(pulse_db, pulse_client, 0.025)).toFixed(2); //max: 95%
   else  if(secondsInBetween <= 900)  return Number(0.80 + deviceMatchingScore(pulse_db, pulse_client, 0.05)).toFixed(2);  //max: 90%
   else  if(secondsInBetween <= 1200) return Number(0.70 + deviceMatchingScore(pulse_db, pulse_client, 0.075)).toFixed(2); //max: 85%
   else  if(secondsInBetween <= 1800) return Number(0.50 + deviceMatchingScore(pulse_db, pulse_client, 0.1)).toFixed(2);   //max: 70%
   return 0;
 }