const express = require('express');
const router  = express.Router();
const { pgPool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/v1/hotspots  — list active hotspots with GeoJSON
router.get('/', async (req, res, next) => {
  try {
    const { status = 'active', limit = 20 } = req.query;
    const { rows } = await pgPool.query(`
      SELECT
        id, detected_at, resolved_at, avg_aqi, max_aqi,
        affected_wards, source_type, source_confidence, status, sensor_count,
        ST_AsGeoJSON(polygon)::json  AS polygon_geojson,
        ST_AsGeoJSON(centroid)::json AS centroid_geojson
      FROM pollution_hotspots
      WHERE status = $1
      ORDER BY detected_at DESC
      LIMIT $2
    `, [status, limit]);

    const hotspots = rows.map(r => ({
      id:               r.id,
      detectedAt:       r.detected_at,
      resolvedAt:       r.resolved_at,
      avgAQI:           r.avg_aqi,
      maxAQI:           r.max_aqi,
      affectedWards:    r.affected_wards,
      sourceType:       r.source_type,
      sourceConfidence: r.source_confidence,
      status:           r.status,
      sensorCount:      r.sensor_count,
      polygon:          r.polygon_geojson,
      centroid:         r.centroid_geojson,
      severity: r.avg_aqi > 250 ? 'critical' : r.avg_aqi > 200 ? 'high' : 'moderate',
    }));

    res.json({ hotspots, total: hotspots.length });
  } catch (err) { next(err); }
});

// GET /api/v1/hotspots/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [h] } = await pgPool.query(
      `SELECT *, ST_AsGeoJSON(polygon)::json AS polygon_geojson,
              ST_AsGeoJSON(centroid)::json AS centroid_geojson
       FROM pollution_hotspots WHERE id = $1`,
      [req.params.id]
    );
    if (!h) return res.status(404).json({ error: 'Hotspot not found' });
    res.json(h);
  } catch (err) { next(err); }
});

// GET /api/v1/hotspots/:id/recommendations
router.get('/:id/recommendations', authenticate, authorize(['admin','officer','superuser']), async (req, res, next) => {
  try {
    const { rows: [h] } = await pgPool.query(
      'SELECT source_type, avg_aqi FROM pollution_hotspots WHERE id = $1',
      [req.params.id]
    );
    if (!h) return res.status(404).json({ error: 'Hotspot not found' });

    const recs = {
      construction_dust: ['Deploy water sprinklers within 500m', 'Install dust barrier screens', 'Issue site compliance notice', 'Schedule field inspection'],
      vehicle_emissions: ['Optimize traffic signals on corridor', 'Restrict heavy goods vehicles (6am–10pm)', 'Promote alternate routes via advisory', 'Deploy traffic police'],
      biomass_burning:   ['Dispatch field enforcement team', 'Issue Section 144 notice if persistent', 'Alert nearest fire station', 'PCB complaint registration'],
      industrial:        ['Alert State Pollution Control Board', 'Request stack emission log', 'Emergency stack inspection', 'Issue show-cause notice'],
      dust_storm:        ['Broadcast public emergency advisory', 'Recommend school closures', 'Activate emergency health centers', 'Monitor air quality every 30 min'],
    };

    res.json({
      hotspotId: req.params.id,
      sourceType: h.source_type,
      avgAQI: h.avg_aqi,
      recommendations: recs[h.source_type] || ['Monitor situation', 'Deploy field team for investigation'],
      priorityLevel: h.avg_aqi > 250 ? 'IMMEDIATE' : h.avg_aqi > 200 ? 'URGENT' : 'STANDARD',
    });
  } catch (err) { next(err); }
});

// PATCH /api/v1/hotspots/:id/resolve
router.patch('/:id/resolve', authenticate, authorize(['admin','superuser']), async (req, res, next) => {
  try {
    const { rows: [h] } = await pgPool.query(
      `UPDATE pollution_hotspots SET status='resolved', resolved_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!h) return res.status(404).json({ error: 'Hotspot not found' });
    const io = req.app.get('io');
    io.emit('hotspot:resolved', { id: req.params.id });
    res.json(h);
  } catch (err) { next(err); }
});

module.exports = router;
