const express = require('express');
const router = express.Router();
const { pgPool } = require('../config/database');

// GET /api/v1/traffic/reroute — Predictive Traffic Rerouting API for navigation apps
router.get('/reroute', async (req, res, next) => {
  try {
    // In a real app, this would query the latest predictions from ml-service or DB
    // Here we query recent predictions where AQI > 200
    const { rows } = await pgPool.query(`
      SELECT 
        p.ward_id, w.name, p.forecast_6h, 
        ST_AsGeoJSON(w.boundary)::json AS boundary_geojson
      FROM aqi_predictions p
      JOIN wards w ON w.id = p.ward_id
      WHERE p.forecast_6h > 200
      ORDER BY p.generated_at DESC
      LIMIT 10
    `);

    // If no active predictions match, provide an empty or mock recommendation
    const hotspots = rows.length > 0 ? rows : [
      {
        ward_id: 1,
        name: 'Connaught Place',
        forecast_6h: 215,
        boundary_geojson: { type: "Polygon", coordinates: [[[77.21, 28.62], [77.22, 28.62], [77.22, 28.63], [77.21, 28.63], [77.21, 28.62]]] }
      }
    ];

    const instructions = hotspots.map(h => ({
      zone: h.name,
      severity: h.forecast_6h > 300 ? 'CRITICAL' : 'HIGH',
      expected_aqi: h.forecast_6h,
      reroute_instruction: 'Redirect heavy goods vehicles (HGVs) and suggest alternate routes for passenger cars.',
      speed_limit_override: 30, // km/h
      restricted_polygon: h.boundary_geojson
    }));

    res.json({
      timestamp: new Date(),
      active_reroutes: instructions,
      api_version: '1.0'
    });
  } catch (err) { next(err); }
});

module.exports = router;
