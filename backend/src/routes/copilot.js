const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { pgPool } = require('../config/database');
const { OpenAI } = require('openai');

// POST /api/v1/copilot/ask
router.post('/ask', authenticate, authorize(['admin', 'officer']), async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') return res.status(400).json({ error: 'Query is required and must be a string' });
    if (query.length > 1000) return res.status(400).json({ error: 'Query exceeds maximum length of 1000 characters' });

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OpenAI API key is missing. Please configure it in the backend .env file.' });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Step 1: Fetch relevant context for RAG
    const { rows: hotspots } = await pgPool.query('SELECT name, forecast_6h FROM aqi_predictions p JOIN wards w ON w.id = p.ward_id WHERE p.forecast_6h > 150 LIMIT 5');
    const hotspotContext = hotspots.map(h => `${h.name} (Predicted AQI: ${h.forecast_6h})`).join(', ') || 'None';

    const { rows: stats } = await pgPool.query(`
      SELECT verification_status, COUNT(*) as count 
      FROM reports 
      WHERE created_at > NOW() - INTERVAL '24 hours' 
      GROUP BY verification_status
    `);
    const reportStats = stats.map(s => `${s.verification_status}: ${s.count}`).join(', ') || 'No recent reports';

    // Step 2: Call the LLM
    const systemPrompt = `You are Eco-Copilot, an advanced AI assistant for the Local AQI Dashboard's Administrators and Field Officers.
Your goal is to provide actionable, concise, and operational advice regarding air quality, pollution reports, and city health.

Current System Context:
- High Pollution Hotspots (Next 6h): ${hotspotContext}
- Report Stats (Last 24h): ${reportStats}

Guidelines:
- Keep your answers concise, professional, and directly useful for city staff.
- If asked about hotspots, refer to the provided context.
- Suggest actionable policies (e.g. dispatching officers, rerouting traffic, issuing advisories).`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ],
      temperature: 0.7,
      max_tokens: 400,
    });

    res.json({
      query,
      response: completion.choices[0].message.content,
      model: 'Eco-Copilot (OpenAI gpt-4o-mini)',
      contextUsed: { hotspots, stats }
    });
  } catch (err) { next(err); }
});

// POST /api/v1/copilot/advisory
router.post('/advisory', authenticate, async (req, res, next) => {
  try {
    const { aqi, wardName, pm25, pm10 } = req.body;
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OpenAI API key is missing.' });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `You are a medical health advisor AI. The current AQI in ${wardName} is ${aqi}. PM2.5 is ${pm25} and PM10 is ${pm10}. 
Provide a short, empathetic, and highly personalized health advisory (max 3 sentences) for a citizen living in this ward. Use emojis.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 150,
    });

    res.json({ advisory: completion.choices[0].message.content });
  } catch (err) { next(err); }
});

module.exports = router;
