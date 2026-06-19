const express = require('express');
const router  = express.Router();
const { Alert } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// GET /api/v1/alerts  — list alerts with filters
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { severity, resolved, wardId, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (severity) filter.severity = severity;
    if (wardId)   filter.wardId   = parseInt(wardId);
    if (resolved !== undefined) filter.resolved = resolved === 'true';

    const [alerts, total] = await Promise.all([
      Alert.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)),
      Alert.countDocuments(filter),
    ]);
    res.json({ alerts, total, page: parseInt(page) });
  } catch (err) { next(err); }
});

// GET /api/v1/alerts/count  — unresolved count for badge
router.get('/count', authenticate, async (req, res, next) => {
  try {
    const count = await Alert.countDocuments({ resolved: false });
    res.json({ count });
  } catch (err) { next(err); }
});

// GET /api/v1/alerts/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json(alert);
  } catch (err) { next(err); }
});

// PATCH /api/v1/alerts/:id/resolve  — admin resolves alert
router.patch('/:id/resolve', authenticate, authorize(['admin', 'officer']), async (req, res, next) => {
  try {
    const alert = await Alert.findByIdAndUpdate(req.params.id, {
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy: req.user.name || req.user.email,
    }, { new: true });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    // Broadcast resolution to dashboard
    const io = req.app.get('io');
    io.to('alerts').emit('alert:resolved', { id: req.params.id });
    io.emit('alert:badge', { count: await Alert.countDocuments({ resolved: false }) });

    res.json(alert);
  } catch (err) { next(err); }
});

// DELETE /api/v1/alerts/:id  — admin only
router.delete('/:id', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    await Alert.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/v1/alerts/manual  — admin creates manual alert
router.post('/manual', authenticate, authorize(['admin']), validate('manualAlert'), async (req, res, next) => {
  try {
    const { wardId, wardName, message, severity, recommendations } = req.body;
    const alert = await Alert.create({
      wardId, wardName, type: 'manual', severity, message,
      recommendations: recommendations || [],
      resolved: false,
    });

    const io = req.app.get('io');
    io.to('alerts').emit('alert:new', alert);
    io.emit('alert:badge', { count: await Alert.countDocuments({ resolved: false }) });

    res.status(201).json(alert);
  } catch (err) { next(err); }
});

module.exports = router;
