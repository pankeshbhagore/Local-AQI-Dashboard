'use strict';
/**
 * Notification Service — Firebase Cloud Messaging (optional).
 * All functions silently no-op if Firebase credentials not configured.
 */

let admin = null;

function initFirebase() {
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const privateKey  = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  if (!projectId || !privateKey || !clientEmail) return;

  try {
    const fb = require('firebase-admin');
    if (!fb.apps.length) {
      fb.initializeApp({ credential: fb.credential.cert({ projectId, privateKey, clientEmail }) });
    }
    admin = fb;
    console.log('✅ Firebase Admin initialised');
  } catch (e) {
    console.warn('⚠️ Firebase init failed:', e.message);
  }
}
initFirebase();

async function sendPush(fcmToken, title, body, data = {}) {
  if (!admin || !fcmToken) return false;
  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    });
    return true;
  } catch (e) { return false; }
}

async function sendTopicPush(topic, title, body, data = {}) {
  if (!admin) return false;
  try {
    await admin.messaging().send({
      topic,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    });
    return true;
  } catch (e) { return false; }
}

async function broadcastWardAlert(wardId, wardName, aqi, severity) {
  const titles = {
    critical: `🚨 CRITICAL: ${wardName} AQI Hazardous`,
    high:     `⚠️ WARNING: ${wardName} Air Quality Poor`,
    moderate: `ℹ️ NOTICE: ${wardName} Air Quality Moderate`,
  };
  const bodies = {
    critical: `AQI ${aqi} — Hazardous. Stay indoors immediately.`,
    high:     `AQI ${aqi} — Very Poor. Avoid outdoor activity.`,
    moderate: `AQI ${aqi} — Moderate. Reduce outdoor exercise.`,
  };
  return sendTopicPush(
    `ward_${wardId}_alerts`,
    titles[severity] || `AQI Alert — ${wardName}`,
    bodies[severity] || `AQI: ${aqi}`,
    { wardId: String(wardId), aqi: String(aqi), severity }
  );
}

module.exports = { sendPush, sendTopicPush, broadcastWardAlert };
