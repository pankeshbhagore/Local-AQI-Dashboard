'use strict';
const { Kafka } = require('kafkajs');
const { pgPool } = require('../config/database');

const kafka = new Kafka({
  clientId: 'aqi-backend',
  brokers:  (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: { initialRetryTime: 1000, retries: 5 },
  logLevel: 1, // WARN only
});

const consumer = kafka.consumer({ groupId: 'aqi-processor' });

async function startKafkaConsumer(io) {
  try {
    await consumer.connect();
    await consumer.subscribe({
      topics: ['aqi-readings', 'satellite-data'],
      fromBeginning: false,
    });

    await consumer.run({
      eachBatch: async ({ batch, heartbeat }) => {
        try {
          const messages = batch.messages.map(m => {
            try { return JSON.parse(m.value.toString()); }
            catch { return null; }
          }).filter(Boolean);

          if (batch.topic === 'aqi-readings')   await processBatch(messages, io);
          if (batch.topic === 'satellite-data')  await processSatelliteData(messages, io);
        } catch (err) {
          console.warn('Kafka batch processing error:', err.message);
        }
        await heartbeat();
      },
    });

    console.log('✅ Kafka consumer running');
  } catch (err) {
    // Kafka not available — gracefully degrade. Sensor data still arrives via MQTT.
    console.warn('⚠️ Kafka not available — running without Kafka streaming:', err.message);
  }
}

async function processBatch(readings, io) {
  if (!readings.length) return;
  for (const r of readings) {
    try {
      await pgPool.query(
        `INSERT INTO sensor_readings
         (sensor_id, ward_id, pm25, pm10, co, no2, so2, o3, aqi_calculated, recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW())
         ON CONFLICT DO NOTHING`,
        [r.sensorId, r.wardId, r.pm25, r.pm10, r.co, r.no2, r.so2, r.o3, r.aqi]
      );
    } catch (err) {
      console.warn('Kafka batch insert failed:', err.message);
    }
  }
}

async function processSatelliteData(data, io) {
  for (const item of data) {
    try {
      await pgPool.query(
        `INSERT INTO satellite_readings
         (source, acquisition_time, fire_detected, smoke_detected, created_at)
         VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT DO NOTHING`,
        [item.source || 'unknown', item.acquisitionTime || new Date(),
         item.fireDetected || false, item.smokeDetected || false]
      );
      if (io && (item.fireDetected || item.smokeDetected)) {
        io.to('alerts').emit('satellite:alert', { type: 'fire_smoke', ...item });
      }
    } catch (err) {
      console.warn('Satellite data insert failed:', err.message);
    }
  }
}

async function stopKafkaConsumer() {
  try { await consumer.disconnect(); } catch { /* ignore */ }
}

module.exports = { startKafkaConsumer, stopKafkaConsumer };
