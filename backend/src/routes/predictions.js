'use strict';
const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const { pgPool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { OpenAI } = require('openai');

const ML_SERVICE = process.env.ML_SERVICE_URL || 'http://ml-service:8000';
const ML_API_KEY = process.env.ML_API_KEY || 'secure_ml_api_key_123';
const ML_TIMEOUT = 8000;

async function callML(endpoint, data) {
  const res = await axios.post(`${ML_SERVICE}${endpoint}`, data, {
    timeout: ML_TIMEOUT,
    headers: { 'Content-Type': 'application/json', 'X-API-Key': ML_API_KEY },
  });
  return res.data;
}

// ── GET /api/v1/predictions/ward/:wardId ──────────────────────────────────
router.get('/ward/:wardId', async (req, res, next) => {
  try {
    const wardId = parseInt(req.params.wardId);

    const { rows: history } = await pgPool.query(
      `SELECT pm25, pm10, co, no2, so2, o3, aqi_calculated,
              COALESCE(temperature, 25)   AS temperature,
              COALESCE(humidity, 60)      AS humidity,
              COALESCE(wind_speed, 3.0)   AS wind_speed,
              EXTRACT(HOUR FROM recorded_at)::int AS hour_of_day,
              EXTRACT(DOW  FROM recorded_at)::int AS day_of_week
       FROM sensor_readings
       WHERE ward_id = $1 AND recorded_at > NOW() - INTERVAL '72 hours'
       ORDER BY recorded_at ASC`,
      [wardId]
    );

    if (history.length < 2) {
      const mockAQI = 150 + Math.floor(Math.random() * 100);
      return res.json({
        wardId,
        forecast_6h:    mockAQI,
        forecast_12h:   mockAQI + 15,
        forecast_24h:   mockAQI - 10,
        ci_low_6h:      mockAQI - 20,
        ci_high_6h:     mockAQI + 20,
        ci_low_12h:     mockAQI - 30,
        ci_high_12h:    mockAQI + 30,
        model:          'MockFallback',
        confidence_pct: 40,
        trend:          'stable',
        note:           'Run sensor-simulator.js to generate real predictions',
        timeline: Array.from({ length: 32 }, (_, i) => ({
          time:     `${i}h`,
          isActual: i < 8,
          forecast: mockAQI + Math.floor(Math.sin(i) * 20),
          upper:    mockAQI + 30,
          lower:    mockAQI - 30,
        })),
      });
    }

    try {
      const prediction = await callML('/predict/aqi', { wardId, features: history });
      pgPool.query(
        `INSERT INTO aqi_predictions
         (ward_id, generated_at, forecast_6h, forecast_12h, forecast_24h,
          confidence_low_6h, confidence_high_6h, confidence_low_12h, confidence_high_12h, model_used)
         VALUES ($1, DATE_TRUNC('hour',NOW()), $2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT ON CONSTRAINT aqi_pred_ward_hour
         DO UPDATE SET forecast_6h=EXCLUDED.forecast_6h, forecast_12h=EXCLUDED.forecast_12h,
           forecast_24h=EXCLUDED.forecast_24h`,
        [wardId,
         prediction.forecast_6h, prediction.forecast_12h, prediction.forecast_24h,
         prediction.ci_low_6h, prediction.ci_high_6h,
         prediction.ci_low_12h, prediction.ci_high_12h,
         prediction.model]
      ).catch(() => {});
      return res.json(prediction);
    } catch (mlErr) {
      const { rows: cached } = await pgPool.query(
        `SELECT * FROM aqi_predictions WHERE ward_id=$1 ORDER BY generated_at DESC LIMIT 1`,
        [wardId]
      );
      if (cached.length) return res.json({ ...cached[0], cached: true, model: 'CachedFallback' });

      const avg = history.reduce((s, r) => s + (r.aqi_calculated || 0), 0) / history.length;
      const aqi = Math.round(avg) || 150;
      return res.json({
        wardId, forecast_6h: aqi, forecast_12h: aqi + 10, forecast_24h: aqi - 8,
        ci_low_6h: aqi - 15, ci_high_6h: aqi + 15,
        ci_low_12h: aqi - 22, ci_high_12h: aqi + 22,
        model: 'StatFallback', confidence_pct: 60, trend: 'stable',
        timeline: history.slice(-8).map((r, i) => ({
          time: `${i}h`, isActual: true,
          forecast: r.aqi_calculated || aqi,
          upper:    (r.aqi_calculated || aqi) + 18,
          lower:    (r.aqi_calculated || aqi) - 18,
        })).concat(Array.from({ length: 24 }, (_, i) => ({
          time: `+${i + 1}h`, isActual: false,
          forecast: aqi + Math.round(Math.sin(i) * 12),
          upper: aqi + 25, lower: aqi - 25,
        }))),
      });
    }
  } catch (err) { next(err); }
});

// ── GET /api/v1/predictions/hotspots ─────────────────────────────────────
router.get('/hotspots', authenticate, async (req, res, next) => {
  try {
    // FIX: Remove TypeScript 'as string' syntax — this is plain JS
    const threshold = parseInt(String(req.query.threshold || '150'));
    const { rows: sensors } = await pgPool.query(
      `SELECT DISTINCT ON (ward_id) ward_id, aqi_calculated,
              ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat
       FROM sensor_readings
       WHERE recorded_at > NOW() - INTERVAL '30 minutes'
         AND aqi_calculated > $1
         AND location IS NOT NULL
       ORDER BY ward_id, recorded_at DESC`,
      [threshold]
    );
    if (!sensors.length) return res.json({ hotspots: [] });
    try {
      const result = await callML('/detect/hotspots', { sensors, threshold });
      return res.json(result);
    } catch {
      return res.json({ hotspots: [] });
    }
  } catch (err) { next(err); }
});

// ── GET /api/v1/predictions/source/:wardId ────────────────────────────────
router.get('/source/:wardId', async (req, res, next) => {
  try {
    const { rows: [latest] } = await pgPool.query(
      `SELECT sr.pm25, sr.pm10, sr.co, sr.no2, sr.so2, sr.o3,
              sr.temperature, sr.humidity, sr.wind_speed,
              COALESCE(tw.vehicle_density, 200)  AS vehicle_density,
              COALESCE(tw.congestion_index, 6.0) AS congestion_index
       FROM sensor_readings sr
       LEFT JOIN traffic_data tw ON tw.ward_id = sr.ward_id
         AND tw.recorded_at > NOW() - INTERVAL '1 hour'
       WHERE sr.ward_id = $1
       ORDER BY sr.recorded_at DESC LIMIT 1`,
      [req.params.wardId]
    );

    if (!latest) {
      return res.json({
        predicted_source: 'unknown', confidence: 0.5,
        probabilities: { unknown: 1.0 },
        recommendations: ['No sensor data available yet'],
        model: 'NoData',
      });
    }

    if (process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const prompt = `You are an AI environmental scientist. Based on the following raw sensor data for a city ward, determine the single most likely dominant source of pollution, and provide 3 actionable policy recommendations for the city administration.
        
Sensor Data:
PM2.5: ${latest.pm25} µg/m³
PM10: ${latest.pm10} µg/m³
CO: ${latest.co} mg/m³
NO2: ${latest.no2} ppb
SO2: ${latest.so2} ppb
O3: ${latest.o3} ppb
Temperature: ${latest.temperature}°C
Humidity: ${latest.humidity}%
Wind Speed: ${latest.wind_speed} m/s
Vehicle Density: ${latest.vehicle_density} cars/hour

Return a JSON object strictly matching this format:
{
  "predicted_source": "construction_dust" | "vehicle_emissions" | "biomass_burning" | "industrial" | "unknown",
  "confidence": 0.85,
  "probabilities": { "construction_dust": 0.1, "vehicle_emissions": 0.7, "biomass_burning": 0.1, "industrial": 0.05, "unknown": 0.05 },
  "recommendations": ["Action 1", "Action 2", "Action 3"]
}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
        });

        const aiResult = JSON.parse(completion.choices[0].message.content);
        return res.json({
          ...aiResult,
          model: 'OpenAI gpt-4o-mini',
        });
      } catch (err) {
        console.error("OpenAI Source Detection Failed:", err.message);
      }
    }

    // Fallback if no OpenAI key
    try {
      const result = await callML('/detect/source', { features: latest });
      return res.json(result);
    } catch {
      const pm25 = latest.pm25 || 0, no2 = latest.no2 || 0,
            so2  = latest.so2  || 0, co  = latest.co  || 0;
      let src = 'unknown';
      if      (so2 > 50 && no2 > 80)    src = 'industrial';
      else if (co  > 15 && no2 > 60)    src = 'vehicle_emissions';
      else if (pm25 > 100 && co > 10)   src = 'biomass_burning';
      else if (pm25 > 150)              src = 'construction_dust';
      return res.json({
        predicted_source: src, confidence: 0.65,
        probabilities: { [src]: 0.65, unknown: 0.35 },
        recommendations: ['Rule-based detection active — please configure OpenAI API key for AI analysis'],
        model: 'RuleBasedFallback',
      });
    }
  } catch (err) { next(err); }
});

module.exports = router;
