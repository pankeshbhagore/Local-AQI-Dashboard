'use strict';
/**
 * Redis Cache Service — gracefully degrades if Redis unavailable.
 */

let client      = null;
let isConnected = false;

async function connectRedis() {
  try {
    const { createClient } = require('redis');
    const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    client = createClient({ url: REDIS_URL, socket: { connectTimeout: 5000 } });
    client.on('error',   e  => { if (isConnected) console.warn('Redis error:', e.message); });
    client.on('connect', () => { isConnected = true;  console.log('✅ Redis connected'); });
    client.on('end',     () => { isConnected = false; });
    await client.connect();
  } catch (err) {
    console.warn('⚠️ Redis not available — running without cache:', err.message);
    client = null;
    isConnected = false;
  }
}

async function get(key) {
  if (!client || !isConnected) return null;
  try { const v = await client.get(key); return v ? JSON.parse(v) : null; }
  catch { return null; }
}

async function set(key, value, ttlSeconds = 60) {
  if (!client || !isConnected) return false;
  try { await client.setEx(key, ttlSeconds, JSON.stringify(value)); return true; }
  catch { return false; }
}

async function del(key) {
  if (!client || !isConnected) return false;
  try { await client.del(key); return true; }
  catch { return false; }
}

async function cacheOrFetch(key, ttlSeconds, fetchFn) {
  const cached = await get(key);
  if (cached !== null) return cached;
  const fresh = await fetchFn();
  await set(key, fresh, ttlSeconds);
  return fresh;
}

const KEYS = {
  cityStats:  () => 'aqi:city:stats',
  wardMap:    () => 'aqi:ward:map',
  wardAQI:    (w) => `aqi:ward:${w}`,
  cityTrend:  () => 'aqi:city:trend',
  prediction: (w) => `pred:ward:${w}`,
  alertCount: () => 'alerts:count',
};

const TTL = { CITY_STATS: 30, WARD_MAP: 30, TREND: 120, PREDICTION: 180, ALERT_COUNT: 15 };

module.exports = { connectRedis, get, set, del, cacheOrFetch, KEYS, TTL, isReady: () => isConnected };
