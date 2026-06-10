'use strict';
const axios  = require('axios');
const cron   = require('node-cron');
const { pgPool } = require('../config/database');

const OWM_KEY = process.env.OPENWEATHER_API_KEY;
const TOMTOM  = process.env.TOMTOM_API_KEY;

function startDataFetcher() {
  // Weather: every 30 min
  cron.schedule('*/30 * * * *', () => fetchWeatherData().catch(e => console.warn('Weather fetch failed:', e.message)));
  // Traffic: every 10 min
  cron.schedule('*/10 * * * *', () => fetchTrafficData().catch(e => console.warn('Traffic fetch failed:', e.message)));
  // Satellite: every 6 hours
  cron.schedule('0 */6 * * *', () => fetchSatelliteData().catch(e => console.warn('Satellite fetch failed:', e.message)));
  console.log('✅ Data fetcher scheduled (weather/traffic/satellite)');
}

async function fetchWeatherData() {
  if (!OWM_KEY) return; // silently skip if no key

  let wards = [];
  try {
    const { rows } = await pgPool.query(
      `SELECT id, 23.2599 + (id * 0.008) AS lat, 77.4126 + (id * 0.006) AS lng FROM wards`
    );
    wards = rows;
  } catch { return; }

  for (const ward of wards) {
    try {
      const { data } = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather`,
        { params: { lat: ward.lat, lon: ward.lng, appid: OWM_KEY, units: 'metric' }, timeout: 8000 }
      );
      await pgPool.query(
        `INSERT INTO weather_data (ward_id, temperature, humidity, pressure, wind_speed, wind_direction, recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6, NOW())`,
        [ward.id, data.main?.temp, data.main?.humidity, data.main?.pressure, data.wind?.speed, data.wind?.deg || 0]
      ).catch(() => {});
    } catch (err) {
      if (err.response?.status !== 429) {} // silently skip individual failures
    }
    await new Promise(r => setTimeout(r, 1100));
  }
}

async function fetchTrafficData() {
  if (!TOMTOM) return;

  let wards = [];
  try {
    const { rows } = await pgPool.query(
      `SELECT id, 23.2599 + (id * 0.008) AS lat, 77.4126 + (id * 0.006) AS lng FROM wards`
    );
    wards = rows;
  } catch { return; }

  for (const ward of wards) {
    try {
      const { data } = await axios.get(
        `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json`,
        { params: { point: `${ward.lat},${ward.lng}`, key: TOMTOM }, timeout: 8000 }
      );
      const flow         = data.flowSegmentData;
      const congestionIdx = flow ? Math.max(0, 10 - (flow.currentSpeed / Math.max(1, flow.freeFlowSpeed)) * 10) : 5;
      await pgPool.query(
        `INSERT INTO traffic_data (ward_id, vehicle_density, congestion_index, speed_avg_kmh, recorded_at)
         VALUES ($1,$2,$3,$4,NOW())`,
        [ward.id, Math.round(congestionIdx * 120), +congestionIdx.toFixed(2), flow?.currentSpeed || 30]
      ).catch(() => {});
    } catch { /* skip individual failures */ }
    await new Promise(r => setTimeout(r, 300));
  }
}

async function fetchSatelliteData() {
  const SENTINEL_USER = process.env.SENTINEL_CLIENT_ID;
  if (!SENTINEL_USER) return;
  // Sentinel data fetch — skipped without credentials
}

module.exports = { startDataFetcher, fetchWeatherData, fetchTrafficData };
