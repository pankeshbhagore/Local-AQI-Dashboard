'use strict';
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  userId:    { type: String, required: true, index: true },
  userName:  { type: String, default: '' },
  userPhone: { type: String, default: '' },
  wardId:    { type: Number, required: true, index: true },
  wardName:  { type: String, default: '' },

  pollutionType: {
    type: String, required: true,
    enum: ['garbage_burning','construction_dust','vehicle_smoke','industrial_emission','dust_storm','other'],
  },
  severity:    { type: String, enum: ['low','medium','high','emergency'], default: 'medium' },
  description: { type: String, maxlength: 1000, default: '' },
  location:    {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },
  },
  address:   { type: String, default: '' },
  photos:    [{ url: String, s3Key: String, uploadedAt: { type: Date, default: Date.now } }],
  nearestAQI:{ type: Number, default: null },

  // ── Verification workflow ──────────────────────────────────────────────
  verificationStatus: {
    type: String,
    enum: ['pending','assigned','under_investigation','verified','rejected','resolved'],
    default: 'pending',
    index: true,
  },

  // Admin assigns to officer
  assignedTo:       { type: String, default: null },   // officer userId
  assignedToName:   { type: String, default: null },
  assignedAt:       { type: Date,   default: null },
  assignmentNote:   { type: String, default: '' },

  // Officer actions
  officerAction:    { type: String, enum: ['investigating','on_site','action_taken','cannot_verify',null], default: null },
  officerNote:      { type: String, default: '' },
  officerActionAt:  { type: Date,   default: null },
  officerName:      { type: String, default: null },

  // Final verification
  verifiedBy:       { type: String, default: null },
  verifiedAt:       { type: Date,   default: null },
  adminNotes:       { type: String, default: '' },

  // Citizen feedback
  citizenFeedback:  { type: String, default: '' },
  citizenRating:    { type: Number, min: 1, max: 5, default: null },

  linkedHotspotId:  { type: String, default: null },
  priority:         { type: Number, default: 2 },  // 1=critical, 2=high, 3=medium, 4=low
}, { timestamps: true });

reportSchema.index({ location: '2dsphere' });
reportSchema.index({ wardId: 1, createdAt: -1 });
reportSchema.index({ verificationStatus: 1, createdAt: -1 });
reportSchema.index({ assignedTo: 1, verificationStatus: 1 });
reportSchema.index({ pollutionType: 1 });

const Report = mongoose.model('Report', reportSchema);
module.exports = Report;
