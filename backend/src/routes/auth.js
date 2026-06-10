'use strict';
const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const User     = require('../models/User');
const { validate }              = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const JWT_SECRET  = process.env.JWT_SECRET  || 'aqi_dashboard_jwt_secret_change_in_production_use_64_chars';
const JWT_REFRESH = process.env.JWT_REFRESH || 'aqi_dashboard_refresh_secret_also_change_in_prod_64_chars';

function signToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role, name: user.name, wardId: user.wardId },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function signRefresh(user) {
  return jwt.sign({ id: user._id }, JWT_REFRESH, { expiresIn: '30d' });
}

// ── POST /api/v1/auth/register ─────────────────────────────────────────────
router.post('/register', validate('register'), async (req, res, next) => {
  try {
    const { email, password, name, phone, role, wardId } = req.body;

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name:   name   || '',
      phone:  phone  || '',
      role:   role   || 'citizen',
      wardId: wardId || null,
    });

    res.status(201).json({
      token:   signToken(user),
      refresh: signRefresh(user),
      user:    user.toPublicJSON(),
    });
  } catch (err) { next(err); }
});

// ── POST /api/v1/auth/login ────────────────────────────────────────────────
router.post('/login', validate('login'), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // passwordHash has select:false — must explicitly include it
    const user = await User.findOne({ email: email.toLowerCase(), isActive: true }).select('+passwordHash');
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    res.json({
      token:   signToken(user),
      refresh: signRefresh(user),
      user:    user.toPublicJSON(),
    });
  } catch (err) { next(err); }
});

// ── POST /api/v1/auth/refresh ──────────────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  try {
    const { refresh } = req.body;
    if (!refresh) return res.status(400).json({ error: 'Refresh token required' });

    let payload;
    try { payload = jwt.verify(refresh, JWT_REFRESH); }
    catch { return res.status(401).json({ error: 'Invalid or expired refresh token' }); }

    const user = await User.findById(payload.id);
    if (!user || !user.isActive) return res.status(401).json({ error: 'Account not found or deactivated' });

    res.json({ token: signToken(user) });
  } catch (err) { next(err); }
});

// ── GET /api/v1/auth/me ────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.isActive) return res.status(404).json({ error: 'User not found' });
    res.json(user.toPublicJSON());
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/auth/fcm-token ──────────────────────────────────────────
router.patch('/fcm-token', authenticate, async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required' });
    await User.findByIdAndUpdate(req.user.id, { fcmToken: token });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── GET /api/v1/auth/users   (admin only) ─────────────────────────────────
router.get('/users', authenticate, authorize(['admin', 'superuser']), async (req, res, next) => {
  try {
    const users = await User.find({}).select('-passwordHash').sort({ createdAt: -1 });
    res.json({ users, total: users.length });
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/auth/users/:id   (admin only) ───────────────────────────
router.patch('/users/:id', authenticate, authorize(['admin', 'superuser']), async (req, res, next) => {
  try {
    const { isActive, role, wardId, name } = req.body;
    const update = {};
    if (isActive !== undefined) update.isActive = isActive;
    if (role)                   update.role     = role;
    if (wardId !== undefined)   update.wardId   = wardId;
    if (name)                   update.name     = name;

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/auth/users/:id   (superuser only) ─────────────────────
router.delete('/users/:id', authenticate, authorize(['superuser']), async (req, res, next) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
