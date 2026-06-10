'use strict';
const { pgPool } = require('../config/database');
const Alert      = require('../models/Alert');

let notifyFn = null;
try {
  const ns = require('./notificationService');
  notifyFn = ns.broadcastWardAlert;
} catch { /* firebase optional */ }

const THRESHOLDS = { critical: 301, high: 201, moderate: 101 };
const CHECK_INTERVAL_MS = 60 * 1000;

function startAlertEngine(io) {
  console.log('🔔 Alert engine started');
  // Run after 5 seconds (let DB settle), then every minute
  setTimeout(() => runAlertCheck(io), 5000);
  setInterval(() => runAlertCheck(io), CHECK_INTERVAL_MS);
}

async function runAlertCheck(io) {
  try {
    const { rows } = await pgPool.query(`
      SELECT DISTINCT ON (sr.ward_id)
        sr.ward_id, w.name AS ward_name,
        sr.aqi_calculated, sr.pm25, sr.dominant_pollutant, sr.recorded_at
      FROM sensor_readings sr
      JOIN wards w ON w.id = sr.ward_id
      WHERE sr.recorded_at > NOW() - INTERVAL '10 minutes'
      ORDER BY sr.ward_id, sr.recorded_at DESC
    `);

    for (const row of rows) {
      await evaluateWardAlert(row, io).catch(e => console.warn('Alert eval error:', e.message));
    }

    await checkOfflineSensors(io).catch(e => console.warn('Offline sensor check error:', e.message));
  } catch (err) {
    console.error('Alert engine error:', err.message);
  }
}

async function evaluateWardAlert(ward, io) {
  const { ward_id, ward_name, aqi_calculated, pm25, dominant_pollutant } = ward;
  if (!aqi_calculated) return;

  let severity = null, type = null;
  if      (aqi_calculated >= THRESHOLDS.critical) { severity = 'critical'; type = 'aqi_critical'; }
  else if (aqi_calculated >= THRESHOLDS.high)      { severity = 'high';     type = 'aqi_poor';     }
  else if (aqi_calculated >= THRESHOLDS.moderate)  { severity = 'moderate'; type = 'aqi_moderate'; }
  else return;

  // De-duplicate: skip if same alert exists in last hour
  const recent = await Alert.findOne({
    wardId:    ward_id,
    type,
    resolved:  false,
    createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
  });
  if (recent) return;

  const p = dominant_pollutant || 'pollutants';
  const messages = {
    critical: `🚨 CRITICAL: ${ward_name} AQI at ${aqi_calculated}. ${p} levels hazardous. Immediate action.`,
    high:     `⚠️ WARNING: ${ward_name} AQI at ${aqi_calculated}. ${p} dangerously high.`,
    moderate: `ℹ️ NOTICE: ${ward_name} AQI reached ${aqi_calculated}. Monitor ${p}.`,
  };
  const recommendations = getRecommendations(dominant_pollutant);

  const alert = await Alert.create({
    wardId: ward_id, wardName: ward_name, type, severity,
    message: messages[severity],
    aqi: aqi_calculated, pm25,
    dominantPollutant: dominant_pollutant,
    recommendations,
    resolved: false,
  });

  if (io) {
    io.to('alerts').emit('alert:new', alert);
    const count = await Alert.countDocuments({ resolved: false });
    io.emit('alert:badge', { count });
  }

  if (notifyFn) {
    notifyFn(ward_id, ward_name, aqi_calculated, severity).catch(() => {});
  }
}

async function checkOfflineSensors(io) {
  const { rows } = await pgPool.query(`
    SELECT sensor_id, ward_id, last_seen
    FROM sensors
    WHERE is_active = true AND last_seen < NOW() - INTERVAL '15 minutes'
  `);

  for (const sensor of rows) {
    await pgPool.query(`UPDATE sensors SET is_active = false WHERE sensor_id = $1`, [sensor.sensor_id]);
    if (io) {
      io.to('alerts').emit('alert:new', {
        type: 'sensor_offline', severity: 'moderate',
        message: `Sensor ${sensor.sensor_id} (Ward ${sensor.ward_id}) went offline`,
        createdAt: new Date(),
      });
    }
  }
}

function getRecommendations(source) {
  const map = {
    pm25: ['Deploy water sprinklers', 'Issue dust notice', 'Field inspection'],
    pm10: ['Water misting on roads', 'Restrict heavy vehicles'],
    no2:  ['Optimize traffic signals', 'Restrict heavy diesel vehicles'],
    so2:  ['Alert Pollution Control Board', 'Check industrial units'],
    co:   ['Traffic congestion management', 'Restrict idling vehicles'],
  };
  return map[source?.toLowerCase()] || ['Monitor situation', 'Field inspection recommended'];
}

module.exports = { startAlertEngine, runAlertCheck };
