const mongoose = require('mongoose');

/**
 * Alert Model
 * Stores automated and manual pollution alerts.
 * Created by alertService.js (background engine) or admin manually.
 */
const alertSchema = new mongoose.Schema(
  {
    wardId: {
      type:    Number,
      default: null,
      index:   true,
    },
    wardName: {
      type:    String,
      default: null,
    },
    type: {
      type:     String,
      required: [true, 'Alert type is required'],
      // aqi_critical | aqi_poor | aqi_moderate | sensor_offline | manual | satellite_fire
      enum: [
        'aqi_critical',
        'aqi_poor',
        'aqi_moderate',
        'sensor_offline',
        'manual',
        'satellite_fire',
        'hotspot_detected',
      ],
    },
    severity: {
      type:     String,
      required: [true, 'Severity is required'],
      enum:     ['moderate', 'high', 'critical'],
    },
    message: {
      type:      String,
      required:  [true, 'Alert message is required'],
      maxlength: 500,
    },

    // Sensor / AQI data at time of alert
    aqi:               { type: Number,  default: null },
    pm25:              { type: Number,  default: null },
    dominantPollutant: { type: String,  default: null },

    // Recommendations for field officers / admins
    recommendations: {
      type:    [String],
      default: [],
    },

    // Resolution tracking
    resolved:    { type: Boolean, default: false, index: true },
    resolvedAt:  { type: Date,    default: null },
    resolvedBy:  { type: String,  default: null },

    // Push notification tracking
    notifiedCount: { type: Number, default: 0 },
    notifiedAt:    { type: Date,   default: null },
  },
  {
    timestamps: true,
  }
);

// Compound index for dashboard queries
alertSchema.index({ severity: 1, resolved: 1, createdAt: -1 });
alertSchema.index({ wardId: 1, createdAt: -1 });

// Static: count unresolved alerts
alertSchema.statics.countUnresolved = function () {
  return this.countDocuments({ resolved: false });
};

// Static: get recent alerts for dashboard
alertSchema.statics.getRecent = function (limit = 20) {
  return this.find()
    .sort({ createdAt: -1 })
    .limit(limit);
};

const Alert = mongoose.model('Alert', alertSchema);

module.exports = Alert;
