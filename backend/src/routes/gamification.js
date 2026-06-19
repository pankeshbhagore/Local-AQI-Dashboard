const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

// GET /api/v1/gamification/leaderboard
router.get('/leaderboard', authenticate, async (req, res, next) => {
  try {
    let rawLimit = parseInt(req.query.limit, 10);
    if (isNaN(rawLimit)) rawLimit = 10;
    const limit = Math.max(1, Math.min(100, rawLimit));
    const users = await User.find({ greenPoints: { $gt: 0 } })
      .select('name greenPoints wardId')
      .sort({ greenPoints: -1 })
      .limit(limit);

    res.json({ leaderboard: users });
  } catch (err) { next(err); }
});

// GET /api/v1/gamification/rewards
router.get('/rewards', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('greenPoints rewardHistory');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      greenPoints: user.greenPoints,
      history: user.rewardHistory.sort((a, b) => b.date - a.date),
    });
  } catch (err) { next(err); }
});

module.exports = router;
