require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const diagnoseRoute = require('./routes/diagnose');
const askRoute = require('./routes/ask');
const historyRoute = require('./routes/history');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Créer dossier uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ─── Routes API ────────────────────────────────────────────
app.use('/api/diagnose', diagnoseRoute);
app.use('/api/ask', askRoute);
app.use('/api/history', historyRoute);

// Route de santé
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ELEC-AI Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── MongoDB ───────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/elecai')
  .then(() => console.log('✅ MongoDB connecté'))
  .catch((err) => console.warn('⚠️  MongoDB non disponible (mode sans BDD):', err.message));

// ─── Démarrage ─────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔧 ELEC-AI Backend démarré sur http://localhost:${PORT}`);
  console.log(`📱 API disponible: http://localhost:${PORT}/api`);
});

module.exports = app;
