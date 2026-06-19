const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { pgPool } = require('../config/database');

// POST /api/v1/copilot/ask
router.post('/ask', authenticate, authorize(['admin', 'officer']), async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') return res.status(400).json({ error: 'Query is required and must be a string' });
    if (query.length > 1000) return res.status(400).json({ error: 'Query exceeds maximum length of 1000 characters' });

    // Step 1: Fetch relevant context for RAG (Retrieval-Augmented Generation)
    const { rows: hotspots } = await pgPool.query('SELECT name, forecast_6h FROM aqi_predictions p JOIN wards w ON w.id = p.ward_id WHERE p.forecast_6h > 150 LIMIT 3');
    const hotspotContext = hotspots.map(h => `${h.name} (AQI: ${h.forecast_6h})`).join(', ') || 'None';

    // Step 2: Call the LLM (Mocked for now)
    // In production, this would use the official OpenAI/Gemini Node SDK.
    const mockResponse = `Based on current city-wide data, the primary hotspots are ${hotspotContext}. 

The sudden spike in these areas over the last 24 hours is highly correlated with increased vehicular emissions and localized construction dust. I recommend:
1. Deploying field officers to the worst affected ward to inspect construction sites for dust barrier compliance.
2. Using the Traffic Rerouting API to restrict HGV access in these wards for the next 6 hours.
3. Broadcasting a public health advisory recommending masks for vulnerable populations in the affected zones.`;

    res.json({
      query,
      response: mockResponse,
      model: 'Eco-Copilot (Mocked)',
      contextUsed: { hotspots }
    });
  } catch (err) { next(err); }
});

module.exports = router;
