/**
 * Models barrel export
 * Each model lives in its own file.
 * Usage: const { User, Alert, Report } = require('../models');
 */
const User   = require('./User');
const Alert  = require('./Alert');
const Report = require('./Report');

module.exports = { User, Alert, Report };
