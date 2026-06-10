'use strict';
const winston = require('winston');
const fs      = require('fs');
const path    = require('path');

// ── Ensure logs directory exists ──────────────────────────────────────────
const logsDir = path.join(process.cwd(), 'logs');
try { if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true }); }
catch (e) { /* ignore if can't create — use console only */ }

const canWriteLogs = fs.existsSync(logsDir);

// ── Logger ────────────────────────────────────────────────────────────────
const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ level, message, timestamp }) =>
        `${timestamp} [${level}]: ${typeof message === 'object' ? JSON.stringify(message) : message}`
      )
    ),
  }),
];

if (canWriteLogs) {
  transports.push(
    new winston.transports.File({ filename: path.join(logsDir, 'error.log'),    level: 'error' }),
    new winston.transports.File({ filename: path.join(logsDir, 'combined.log') })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports,
});

// ── Error Handler Middleware ───────────────────────────────────────────────
function errorHandler(err, req, res, next) {
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  logger.error({
    message,
    status,
    method: req.method,
    path:   req.path,
    ip:     req.ip,
    stack:  err.stack,
    user:   req.user?.id,
  });

  const body = {
    error:     message,
    status,
    path:      req.path,
    timestamp: new Date().toISOString(),
  };

  if (process.env.NODE_ENV === 'development') body.stack = err.stack;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map(e => e.message);
    return res.status(422).json({ error: 'Validation failed', details });
  }
  // JWT error
  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  // Joi validation (from validate middleware)
  if (err.isJoi) {
    return res.status(422).json({ error: 'Validation failed', details: err.details?.map(d => d.message) });
  }
  // PostgreSQL unique violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Resource already exists' });
  }
  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(422).json({ error: 'Referenced resource not found' });
  }
  // MongoDB duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({ error: `${field} already exists` });
  }

  res.status(status).json(body);
}

module.exports = errorHandler;
module.exports.logger = logger;
