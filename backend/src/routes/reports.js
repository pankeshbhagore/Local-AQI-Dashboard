'use strict';
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const Report  = require('../models/Report');
const { Alert } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { pgPool } = require('../config/database');

// S3 optional
let s3Client = null;
const S3_BUCKET = process.env.S3_BUCKET;
if (S3_BUCKET) {
  try { const { S3Client } = require('@aws-sdk/client-s3'); s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' }); }
  catch (e) { console.warn('S3 unavailable'); }
}
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── POST /api/v1/reports — Citizen submits report ─────────────────────────
router.post('/', authenticate, upload.array('photos', 5), async (req, res, next) => {
  try {
    const { wardId, pollutionType, severity, description, lat, lng, address } = req.body;
    if (!wardId || !pollutionType) return res.status(400).json({ error: 'wardId and pollutionType are required' });

    const photos = [];
    if (s3Client && S3_BUCKET) {
      for (const file of (req.files || [])) {
        try {
          const { PutObjectCommand } = require('@aws-sdk/client-s3');
          const key = `reports/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
          await s3Client.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: file.buffer, ContentType: file.mimetype }));
          photos.push({ url: `https://${S3_BUCKET}.s3.amazonaws.com/${key}`, s3Key: key });
        } catch (e) { console.warn('S3 upload failed:', e.message); }
      }
    }

    let nearestAQI = null, wardName = '';
    try {
      const [aqiR, wardR] = await Promise.all([
        pgPool.query(`SELECT aqi_calculated FROM sensor_readings WHERE ward_id=$1 ORDER BY recorded_at DESC LIMIT 1`, [wardId]),
        pgPool.query(`SELECT name FROM wards WHERE id=$1`, [wardId]),
      ]);
      nearestAQI = aqiR.rows[0]?.aqi_calculated ?? null;
      wardName   = wardR.rows[0]?.name ?? '';
    } catch (_) {}

    // Set priority based on severity
    const priorityMap = { emergency: 1, high: 2, medium: 3, low: 4 };

    const report = await Report.create({
      userId:    req.user.id,
      userName:  req.user.name || req.user.email,
      wardId:    parseInt(wardId),
      wardName,
      pollutionType,
      severity:  severity || 'medium',
      priority:  priorityMap[severity] || 3,
      description: description || '',
      location:  { type: 'Point', coordinates: [parseFloat(lng) || 0, parseFloat(lat) || 0] },
      address:   address || '',
      photos,
      nearestAQI,
      verificationStatus: 'pending',
    });

    // Emit real-time to admin/officer dashboards
    const io = req.app.get('io');
    if (io) {
      io.to('staff').emit('report:new', {
        _id: report._id, wardName, pollutionType, severity, wardId: parseInt(wardId),
        userName: req.user.name, createdAt: report.createdAt,
      });
    }

    res.status(201).json({ success: true, reportId: report._id, message: 'Report submitted successfully. A field officer will review it shortly.' });
  } catch (err) { next(err); }
});

// ── GET /api/v1/reports — Staff: list all reports ─────────────────────────
router.get('/', authenticate, authorize(['admin','officer','superuser']), async (req, res, next) => {
  try {
    const { wardId, status, type, page = 1, limit = 20, assignedTo, priority, startDate, endDate } = req.query;
    const filter = {};
    if (wardId)     filter.wardId = parseInt(wardId);
    if (status)     filter.verificationStatus = status;
    if (type)       filter.pollutionType = type;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (priority)   filter.priority = parseInt(priority);
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate)   filter.createdAt.$lte = new Date(endDate);
    }
    // Officers only see their assigned reports + unassigned
    if (req.user.role === 'officer') {
      filter.$or = [{ assignedTo: req.user.id }, { verificationStatus: 'pending' }];
      delete filter.assignedTo;
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [reports, total] = await Promise.all([
      Report.find(filter).sort({ priority: 1, createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Report.countDocuments(filter),
    ]);
    res.json({ reports, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { next(err); }
});

// ── GET /api/v1/reports/stats — Admin analytics ───────────────────────────
router.get('/stats', authenticate, authorize(['admin','superuser']), async (req, res, next) => {
  try {
    const [total, pending, assigned, investigating, verified, rejected, resolved, byType, bySeverity, byWard] = await Promise.all([
      Report.countDocuments(),
      Report.countDocuments({ verificationStatus: 'pending' }),
      Report.countDocuments({ verificationStatus: 'assigned' }),
      Report.countDocuments({ verificationStatus: 'under_investigation' }),
      Report.countDocuments({ verificationStatus: 'verified' }),
      Report.countDocuments({ verificationStatus: 'rejected' }),
      Report.countDocuments({ verificationStatus: 'resolved' }),
      Report.aggregate([{ $group: { _id: '$pollutionType', count: { $sum: 1 } } }]),
      Report.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
      Report.aggregate([{ $group: { _id: '$wardName', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    ]);
    // Recent trend (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const trend = await Report.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({ total, pending, assigned, investigating, verified, rejected, resolved, byType, bySeverity, byWard, trend });
  } catch (err) { next(err); }
});

// ── GET /api/v1/reports/citizen/mine — Citizen: own reports ──────────────
router.get('/citizen/mine', authenticate, async (req, res, next) => {
  try {
    const reports = await Report.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50);
    res.json({ reports, total: reports.length });
  } catch (err) { next(err); }
});

// ── GET /api/v1/reports/:id ───────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    // Citizens can only see their own
    if (req.user.role === 'citizen' && report.userId !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });
    res.json(report);
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/reports/:id/assign — Admin assigns to officer ───────────
router.patch('/:id/assign', authenticate, authorize(['admin','superuser']), async (req, res, next) => {
  try {
    const { officerId, officerName, note } = req.body;
    if (!officerId) return res.status(400).json({ error: 'officerId required' });

    const report = await Report.findByIdAndUpdate(req.params.id, {
      assignedTo:     officerId,
      assignedToName: officerName || 'Officer',
      assignedAt:     new Date(),
      assignmentNote: note || '',
      verificationStatus: 'assigned',
    }, { new: true });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    // Notify officer via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`officer:${officerId}`).emit('report:assigned', {
        reportId:  report._id,
        wardName:  report.wardName,
        pollutionType: report.pollutionType,
        severity:  report.severity,
        note,
        assignedBy: req.user.name,
      });
      io.to('staff').emit('report:updated', { _id: report._id, verificationStatus: 'assigned', assignedToName: officerName });
    }

    res.json({ success: true, report });
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/reports/:id/action — Officer takes action ──────────────
router.patch('/:id/action', authenticate, authorize(['officer','admin','superuser']), async (req, res, next) => {
  try {
    const { action, note, status } = req.body;
    // action: 'investigating' | 'on_site' | 'action_taken' | 'cannot_verify'
    // status: 'under_investigation' | 'verified' | 'rejected' | 'resolved'
    const update = {
      officerAction:   action,
      officerNote:     note || '',
      officerActionAt: new Date(),
      officerName:     req.user.name || req.user.email,
    };
    if (status) {
      update.verificationStatus = status;
      if (['verified','resolved'].includes(status)) {
        update.verifiedBy = req.user.name;
        update.verifiedAt = new Date();
      }
    }

    const report = await Report.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    // Notify admin + citizen
    const io = req.app.get('io');
    if (io) {
      io.to('staff').emit('report:updated', { _id: report._id, verificationStatus: report.verificationStatus, officerAction: action });
      io.to(`citizen:${report.userId}`).emit('report:status', {
        reportId: report._id,
        status:   report.verificationStatus,
        action,
        note,
        officerName: req.user.name,
      });
    }

    res.json({ success: true, report });
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/reports/:id/verify — Admin final verify ────────────────
router.patch('/:id/verify', authenticate, authorize(['admin','superuser']), async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    if (!['verified','rejected','resolved'].includes(status))
      return res.status(400).json({ error: 'status must be verified, rejected, or resolved' });

    const report = await Report.findByIdAndUpdate(req.params.id, {
      verificationStatus: status,
      verifiedBy:  req.user.name || req.user.email,
      verifiedAt:  new Date(),
      adminNotes:  notes || '',
    }, { new: true });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const io = req.app.get('io');
    if (io) {
      io.to('staff').emit('report:updated', { _id: report._id, verificationStatus: status });
      io.to(`citizen:${report.userId}`).emit('report:status', { reportId: report._id, status, note: notes });
    }
    res.json({ success: true, report });
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/reports/:id/feedback — Citizen rates resolution ─────────
router.patch('/:id/feedback', authenticate, async (req, res, next) => {
  try {
    const { rating, feedback } = req.body;
    const report = await Report.findOne({ _id: req.params.id, userId: req.user.id });
    if (!report) return res.status(404).json({ error: 'Report not found' });
    report.citizenFeedback = feedback || '';
    report.citizenRating   = rating;
    await report.save();
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
