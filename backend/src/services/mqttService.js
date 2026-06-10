'use strict';
const mqtt = require('mqtt');
const { pgPool }       = require('../config/database');
const { calculateAQI } = require('./aqiCalculator');

let mqttClient = null;

function startMQTTService(io) {
  const brokerUrl = process.env.MQTT_BROKER || 'mqtt://localhost:1883';

  mqttClient = mqtt.connect(brokerUrl, {
    clientId:        `aqi-backend-${Date.now()}`,
    reconnectPeriod: 5000,
    keepalive:       60,
    connectTimeout:  10000,
  });

  mqttClient.on('connect', () => {
    console.log('✅ MQTT connected:', brokerUrl);
    mqttClient.subscribe('sensors/+/readings', { qos: 1 }, (err) => {
      if (err) console.error('MQTT subscribe error:', err.message);
    });
  });

  mqttClient.on('message', async (topic, payload) => {
    try {
      const sensorId = topic.split('/')[1];
      const data     = JSON.parse(payload.toString());
      await processSensorReading(sensorId, data, io);
    } catch (err) {
      // Never crash on bad payload
      console.warn('MQTT message error:', err.message);
    }
  });

  mqttClient.on('error',   (err) => console.warn('MQTT error:', err.message));
  mqttClient.on('offline', ()    => console.warn('⚠️ MQTT offline — retrying...'));
  mqttClient.on('reconnect', ()  => console.log('🔄 MQTT reconnecting...'));

  return mqttClient;
}

async function processSensorReading(sensorId, data, io) {
  const {
    wardId, pm25, pm10, co, no2, so2, o3,
    temperature, humidity, windSpeed, windDirection, lat, lng,
  } = data;

  if (!wardId || pm25 == null) return; // invalid
  if (pm25 < 0 || pm25 > 1500)  return; // outlier rejection

  const { aqi, dominant } = calculateAQI({ pm25, pm10, co, no2, so2, o3 });

  try {
    await pgPool.query(
      `INSERT INTO sensor_readings
       (sensor_id, ward_id, pm25, pm10, co, no2, so2, o3, aqi_calculated,
        dominant_pollutant, temperature, humidity, wind_speed, wind_direction,
        location, recorded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
               ST_SetSRID(ST_MakePoint($15,$16),4326), NOW())`,
      [sensorId, wardId, pm25, pm10 || null, co || null, no2 || null,
       so2 || null, o3 || null, aqi, dominant,
       temperature || null, humidity || null,
       windSpeed || null, windDirection || null,
       lng || 0, lat || 0]
    );

    await pgPool.query(
      `UPDATE sensors SET last_seen = NOW(), is_active = true WHERE sensor_id = $1`,
      [sensorId]
    );
  } catch (err) {
    console.warn(`DB insert failed for sensor ${sensorId}:`, err.message);
    return;
  }

  if (io) {
    io.to(`ward:${wardId}`).emit('aqi:update', {
      wardId, sensorId, aqi, pm25, pm10,
      recordedAt: new Date().toISOString(),
    });
    io.emit('city:update', { wardId, aqi });
  }
}

function publishCommand(sensorId, command) {
  if (!mqttClient || !mqttClient.connected) return;
  mqttClient.publish(
    `sensors/${sensorId}/command`,
    JSON.stringify({ command, timestamp: new Date().toISOString() }),
    { qos: 1 }
  );
}

module.exports = { startMQTTService, publishCommand };
