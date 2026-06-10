const express = require('express');
const router = express.Router();
const { pgPool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { calculateAQI } = require('../services/aqiCalculator');

// GET /api/v1/aqi/map  — all ward AQI values as GeoJSON
router.get('/map', async (req, res, next) => {
  try {
    const { rows } = await pgPool.query(`
      SELECT
        w.id,
        w.name,
        w.zone,
        ST_AsGeoJSON(w.boundary)::json AS geometry,
        r.aqi_calculated,
        r.pm25, r.pm10, r.co, r.no2, r.so2, r.o3,
        r.recorded_at,
        COALESCE(sc.active_sensors, 0) AS active_sensors,
        COALESCE(sc.total_sensors,  0) AS total_sensors
      FROM wards w
      LEFT JOIN LATERAL (
        SELECT aqi_calculated, pm25, pm10, co, no2, so2, o3, recorded_at
        FROM sensor_readings
        WHERE ward_id = w.id
        ORDER BY recorded_at DESC
        LIMIT 1
      ) r ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE is_active = true) AS active_sensors,
          COUNT(*)                                   AS total_sensors
        FROM sensors
        WHERE ward_id = w.id
      ) sc ON true
      ORDER BY w.id
    `);

    const geojson = {
      type: 'FeatureCollection',
      features: rows.map(row => ({
        type: 'Feature',
        geometry: row.geometry,
        properties: {
          id: row.id, name: row.name, zone: row.zone,
          aqi: row.aqi_calculated, pm25: row.pm25, pm10: row.pm10,
          co: row.co, no2: row.no2, so2: row.so2, o3: row.o3,
          lastUpdated: row.recorded_at,
          activeSensors: parseInt(row.active_sensors),
          totalSensors: parseInt(row.total_sensors),
        }
      }))
    };
    res.json(geojson);
  } catch (err) { next(err); }
});

// GET /api/v1/aqi/ward/:wardId  — single ward current AQI + history
router.get('/ward/:wardId', async (req, res, next) => {
  try {
    const { wardId } = req.params;
    const { hours = 24 } = req.query;

    const latest = await pgPool.query(
      `SELECT * FROM sensor_readings WHERE ward_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
      [wardId]
    );

    const history = await pgPool.query(
      `SELECT DATE_TRUNC('hour', recorded_at) AS hour,
              ROUND(AVG(aqi_calculated)) AS aqi,
              ROUND(AVG(pm25)::numeric, 1) AS pm25,
              ROUND(AVG(pm10)::numeric, 1) AS pm10
       FROM sensor_readings
       WHERE ward_id = $1 AND recorded_at > NOW() - INTERVAL '${parseInt(hours)} hours'
       GROUP BY hour ORDER BY hour`,
      [wardId]
    );

    if (!latest.rows.length) return res.status(404).json({ error: 'Ward not found or no data' });

    res.json({
      current: latest.rows[0],
      history: history.rows,
    });
  } catch (err) { next(err); }
});

// GET /api/v1/aqi/city  — city-wide average + top wards
router.get('/city', async (req, res, next) => {
  try {
    const { rows } = await pgPool.query(`
      WITH latest AS (
        SELECT DISTINCT ON (ward_id) ward_id, aqi_calculated, pm25, pm10, recorded_at
        FROM sensor_readings ORDER BY ward_id, recorded_at DESC
      )
      SELECT
        ROUND(AVG(aqi_calculated)) AS city_avg_aqi,
        MAX(aqi_calculated) AS max_aqi,
        MIN(aqi_calculated) AS min_aqi,
        COUNT(*) AS wards_reporting,
        COUNT(*) FILTER (WHERE aqi_calculated > 200) AS critical_wards,
        COUNT(*) FILTER (WHERE aqi_calculated > 100) AS unhealthy_wards
      FROM latest
    `);
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/v1/aqi/reading  — ingest new sensor reading (internal use / IoT)
router.post('/reading', authenticate, async (req, res, next) => {
  try {
    const { sensorId, wardId, pm25, pm10, co, no2, so2, o3, temperature, humidity, windSpeed, windDirection, lat, lng } = req.body;

    const { aqi } = calculateAQI({ pm25, pm10, co, no2, so2, o3 });

    const { rows } = await pgPool.query(
      `INSERT INTO sensor_readings 
       (sensor_id, ward_id, pm25, pm10, co, no2, so2, o3, aqi_calculated, temperature, humidity,
        wind_speed, wind_direction, location, recorded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, ST_SetSRID(ST_MakePoint($14,$15),4326), NOW())
       RETURNING *`,
      [sensorId, wardId, pm25, pm10, co, no2, so2, o3, aqi, temperature, humidity, windSpeed, windDirection, lng, lat]
    );

    // Broadcast via Socket.IO
    const io = req.app.get('io');
    io.to(`ward:${wardId}`).emit('aqi:update', { wardId, aqi, pm25, pm10, recordedAt: new Date() });
    io.emit('city:update', { wardId, aqi });

    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// GET /api/v1/aqi/trend  — 24h city trend
router.get('/trend', async (req, res, next) => {
  try {
    const { rows } = await pgPool.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('hour', recorded_at), 'HH12:MI AM') AS label,
        ROUND(AVG(aqi_calculated)) AS aqi,
        ROUND(AVG(pm25)::numeric, 1) AS pm25,
        ROUND(AVG(pm10)::numeric, 1) AS pm10
      FROM sensor_readings
      WHERE recorded_at > NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', recorded_at)
      ORDER BY DATE_TRUNC('hour', recorded_at)
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
