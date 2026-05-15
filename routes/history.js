// routes/history.js
const express = require('express');
const router = express.Router();
const DiagnosticRecord = require('../models/DiagnosticRecord');

router.get('/', async (req, res) => {
  try {
    const records = await DiagnosticRecord.find().sort({ createdAt: -1 }).limit(50);
    res.json(records);
  } catch (err) {
    res.json([]);
  }
});

router.patch('/:id/resolve', async (req, res) => {
  try {
    await DiagnosticRecord.findByIdAndUpdate(req.params.id, { isResolved: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await DiagnosticRecord.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
