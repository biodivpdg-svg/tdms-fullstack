require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const { testConnection } = require('./config/db');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Ensure uploads dir exists ──────────────────────────
const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ── Middleware ─────────────────────────────────────────
app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || '').split(',').concat(['http://localhost:3001']),
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static: Uploaded files ─────────────────────────────
app.use('/uploads', express.static(uploadDir));

// ── API Routes ─────────────────────────────────────────
app.use('/api/tigers',    require('./routes/tigers'));
app.use('/api/sightings', require('./routes/sightings'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/map',       require('./routes/map'));

// ── Health check ───────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date() }));

// ── Static: Frontend ───────────────────────────────────
const publicDir = path.join(__dirname, '../frontend');
app.use(express.static(publicDir));
app.get('*', (_, res) => res.sendFile(path.join(publicDir, 'index.html')));

// ── Error handler ──────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('❌', err.message);
  res.status(err.status || 500).json({ success: false, error: err.message });
});

// ── Start ──────────────────────────────────────────────
async function start() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`\n🐯  TDMS Server  →  http://localhost:${PORT}`);
    console.log(`📡  API Base     →  http://localhost:${PORT}/api\n`);
  });
}

start();
