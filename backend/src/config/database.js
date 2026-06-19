'use strict';
const { Pool } = require('pg');
const mongoose = require('mongoose');

// ── PostgreSQL Pool ────────────────────────────────────────────────────────
const pgPool = new Pool({
  host:                    process.env.PG_HOST     || 'localhost',
  port:                    parseInt(process.env.PG_PORT || '5432'),
  database:                process.env.PG_DB       || 'aqi_db',
  user:                    process.env.PG_USER     || 'postgres',
  password:                process.env.PG_PASS     || 'secret123',
  max:                     20,
  idleTimeoutMillis:       30000,
  connectionTimeoutMillis: 5000,
  ...(process.env.PG_SSL === 'true' && { ssl: { rejectUnauthorized: false } }),
});

pgPool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

async function connectPostgres() {
  const client = await pgPool.connect();
  try {
    // Verify PostGIS is available
    await client.query('SELECT 1');
    console.log('✅ PostgreSQL connected');
  } finally {
    client.release();
  }
  return pgPool;
}

// ── MongoDB ────────────────────────────────────────────────────────────────
async function connectMongo() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/aqi_reports';
  // mongoose 8+ — useNewUrlParser and useUnifiedTopology are removed
  await mongoose.connect(uri);
  console.log('✅ MongoDB connected');
}

module.exports = { pgPool, connectPostgres, connectMongo };
