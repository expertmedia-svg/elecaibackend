const mongoose = require('mongoose');

const componentSchema = new mongoose.Schema({
  name: String,
  description: String,
  confidence: Number,
  severity: { type: String, enum: ['danger', 'warning', 'normal'], default: 'normal' },
  boundingBox: {
    x: Number, y: Number, w: Number, h: Number,
  },
  action: String,
  testInstruction: String,
});

const testStepSchema = new mongoose.Schema({
  stepNumber: Number,
  title: String,
  instruction: String,
  blackProbePosition: String,
  redProbePosition: String,
  expectedValue: String,
  actionIfNormal: String,
  actionIfAbnormal: String,
});

const diagnosticSchema = new mongoose.Schema({
  device: String,
  fault: String,
  imagePath: String,
  aiConfidence: { type: Number, default: 0 },
  probableCause: String,
  recommendedAction: String,
  components: [componentSchema],
  testSteps: [testStepSchema],
  isResolved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('DiagnosticRecord', diagnosticSchema);
