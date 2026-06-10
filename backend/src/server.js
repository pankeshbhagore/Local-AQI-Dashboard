'use strict';
require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');

const { connectPostgres, connectMongo } = require('./config/database');
const { connectRedis }       = require('./services/redisService');
const { startMQTTService }   = require('./services/mqttService');
const { startKafkaConsumer } = require('./services/kafkaService');
const { startAlertEngine }   = require('./services/alertService');
const { startDataFetcher }   = require('./services/dataFetcher');

const aqiRoutes        = require('./routes/aqi');
const authRoutes       = require('./routes/auth');
const reportRoutes     = require('./routes/reports');
const alertRoutes      = require('./routes/alerts');
const predictionRoutes = require('./routes/predictions');
const hotspotRoutes    = require('./routes/hotspots');
const errorHandler     = require('./middleware/errorHandler');

const app    = express();
const server = http.createServer(app);

// ── CORS — allow all localhost ports ─────────────────────────────────────
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
    const cf = process.env.FRONTEND_URL;
    if (cf && origin === cf) return cb(null, true);
    cb(new Error('CORS blocked: ' + origin));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
};

// ── Socket.IO ─────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
      cb(null, false);
    },
    methods: ['GET','POST'], credentials: true,
  },
  transports: ['websocket','polling'],
});
app.set('io', io);

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false }));

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/v1/auth',        authRoutes);
app.use('/api/v1/aqi',         aqiRoutes);
app.use('/api/v1/reports',     reportRoutes);
app.use('/api/v1/alerts',      alertRoutes);
app.use('/api/v1/predictions', predictionRoutes);
app.use('/api/v1/hotspots',    hotspotRoutes);

app.get('/health', (req, res) => res.json({ status:'ok', timestamp: new Date().toISOString(), version:'2.0.0' }));
app.use((req, res) => res.status(404).json({ error: `${req.method} ${req.path} not found` }));
app.use(errorHandler);

// ── Socket.IO — room-based subscriptions ──────────────────────────────────
io.on('connection', (socket) => {
  // Client sends their role+userId to join appropriate rooms
  socket.on('auth', ({ role, userId }) => {
    if (role === 'admin' || role === 'superuser') socket.join('staff');
    if (role === 'officer') {
      socket.join('staff');
      socket.join(`officer:${userId}`);
    }
    if (role === 'citizen' && userId) socket.join(`citizen:${userId}`);
  });
  socket.on('subscribe:ward',   (wardId) => socket.join(`ward:${wardId}`));
  socket.on('subscribe:alerts', ()       => socket.join('alerts'));
  socket.on('subscribe:staff',  ()       => socket.join('staff'));
  socket.on('auth', (data) => {
    if (data && data.role) {
      if (data.role === 'admin' || data.role === 'superuser') socket.join('staff');
      if (data.role === 'officer' && data.userId) socket.join(`officer:${data.userId}`);
      if (data.role === 'citizen' && data.userId) socket.join(`citizen:${data.userId}`);
    }
  });
  socket.on('disconnect', () => {});
});

// ── Startup ───────────────────────────────────────────────────────────────
async function start() {
  try {
    await connectPostgres();
    await connectMongo();
    console.log('✅ Databases connected');
    await connectRedis();
    startMQTTService(io);
    console.log('✅ MQTT started');
    await startKafkaConsumer(io);
    console.log('✅ Kafka started');
    startAlertEngine(io);
    console.log('✅ Alert engine started');
    startDataFetcher();
    console.log('✅ Data fetcher scheduled');
    const PORT = parseInt(process.env.PORT || '5000');
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 AQI Backend v2.0 on port ${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/health\n`);
    });
  } catch (err) {
    console.error('❌ Startup failed:', err.message);
    process.exit(1);
  }
}
start();
module.exports = { app, io };
