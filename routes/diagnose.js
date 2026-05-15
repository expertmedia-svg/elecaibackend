const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const DiagnosticRecord = require('../models/DiagnosticRecord');

const router = express.Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Multer config ─────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `${uuidv4()}.jpg`),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Format image requis'));
  },
});

// ─── Prompt système IA ────────────────────────────────────
function buildSystemPrompt(device, fault, language) {
  return `Tu es ELEC-AI, un expert en diagnostic électronique spécialisé pour l'Afrique.
Tu analyses des cartes électroniques pour des réparateurs locaux et apprentis.

Appareil: ${device}
Panne déclarée: ${fault}
Langue: ${language || 'fr'}

Règles importantes:
- Réponse en JSON strict uniquement, sans markdown
- Explications simples, accessibles aux débutants
- Instructions concrètes avec mesures précises
- Concentre-toi sur les composants courants: condensateurs, fusibles, IC de charge, régulateurs
- Identifie les zones suspectes avec coordonnées normalisées (0.0 à 1.0)

Format JSON OBLIGATOIRE:
{
  "aiConfidence": 0.0-1.0,
  "probableCause": "Description de la cause probable",
  "recommendedAction": "Action principale recommandée",
  "components": [
    {
      "name": "Nom composant",
      "description": "Description courte",
      "confidence": 0.0-1.0,
      "severity": "danger|warning|normal",
      "boundingBox": {"x": 0.0, "y": 0.0, "w": 0.1, "h": 0.1},
      "action": "Action spécifique",
      "testInstruction": "Comment tester avec multimètre"
    }
  ],
  "testSteps": [
    {
      "stepNumber": 1,
      "title": "Titre étape",
      "instruction": "Instruction détaillée",
      "blackProbePosition": "Position sonde noire (ou null)",
      "redProbePosition": "Position sonde rouge (ou null)",
      "expectedValue": "Valeur attendue (ou null)",
      "actionIfNormal": "Si mesure normale",
      "actionIfAbnormal": "Si mesure anormale"
    }
  ]
}`;
}

// ─── POST /api/diagnose ────────────────────────────────────
router.post('/', upload.single('image'), async (req, res) => {
  const { device = 'phone', fault = 'nopower', language = 'fr' } = req.body;
  const diagId = uuidv4();

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image requise' });
    }

    // Optimiser image
    const optimizedPath = req.file.path.replace('.jpg', '_opt.jpg');
    await sharp(req.file.path)
      .resize(1024, 1024, { fit: 'inside' })
      .jpeg({ quality: 85 })
      .toFile(optimizedPath);

    const imageBase64 = fs.readFileSync(optimizedPath).toString('base64');

    // Appel OpenAI Vision
    let aiResponse;
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 2000,
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt(device, fault, language),
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: 'high',
                },
              },
              {
                type: 'text',
                text: `Analyse cette carte électronique. Appareil: ${device}. Panne: ${fault}. Réponds UNIQUEMENT en JSON.`,
              },
            ],
          },
        ],
      });

      const rawText = completion.choices[0].message.content;
      const cleanJson = rawText.replace(/```json|```/g, '').trim();
      aiResponse = JSON.parse(cleanJson);

    } catch (aiError) {
      console.warn('OpenAI error, using fallback:', aiError.message);
      aiResponse = getFallbackDiagnosis(device, fault);
    }

    // Construire réponse finale
    const result = {
      id: diagId,
      device,
      fault,
      imagePath: `/uploads/${req.file.filename}`,
      aiConfidence: aiResponse.aiConfidence || 0.7,
      probableCause: aiResponse.probableCause || 'Analyse en cours',
      recommendedAction: aiResponse.recommendedAction || 'Procéder aux tests',
      components: (aiResponse.components || []).slice(0, 5),
      testSteps: (aiResponse.testSteps || []).slice(0, 6),
      createdAt: new Date().toISOString(),
    };

    // Sauvegarder en MongoDB (si disponible)
    try {
      await DiagnosticRecord.create(result);
    } catch (dbErr) {
      // Sans MongoDB: continuer quand même
    }

    res.json(result);

  } catch (error) {
    console.error('Erreur diagnostic:', error);
    res.status(500).json({ error: 'Erreur lors de l\'analyse', details: error.message });
  }
});

// ─── Fallback diagnostic sans IA ──────────────────────────
function getFallbackDiagnosis(device, fault) {
  const faultMap = {
    nopower: {
      cause: 'Condensateur défectueux ou fusible grillé',
      action: 'Tester fusible F1, mesurer tension condensateur C3',
    },
    nocharge: {
      cause: 'IC de charge endommagé (TP4056 / BQ24)',
      action: 'Remplacer IC de charge, vérifier port USB',
    },
    overheating: {
      cause: 'Court-circuit sur régulateur de tension',
      action: 'Isoler par zone, tester résistances de puissance',
    },
    blackscreen: {
      cause: 'Rétroéclairage LED défectueux ou connecteur LCD',
      action: 'Tester LED backlight, vérifier nappe',
    },
    nosound: {
      cause: 'Amplificateur audio (PAM8403) défectueux',
      action: 'Remplacer PAM8403, vérifier condensateurs sortie',
    },
    shortcircuit: {
      cause: 'Composant court-circuité sur rail 3.3V',
      action: 'Mesurer résistance sur chaque rail, isoler le composant',
    },
  };

  const f = faultMap[fault] || { cause: 'À diagnostiquer', action: 'Effectuer tests complets' };

  return {
    aiConfidence: 0.65,
    probableCause: f.cause,
    recommendedAction: f.action,
    components: [
      {
        name: 'Condensateur C3', description: '100µF/16V électrolytique',
        confidence: 0.75, severity: fault === 'nopower' ? 'danger' : 'warning',
        boundingBox: { x: 0.25, y: 0.20, w: 0.12, h: 0.10 },
        action: 'Mesurer tension: 3.3V à 5V attendu',
        testInstruction: 'Rouge sur + du condensateur, Noir sur GND',
      },
      {
        name: 'Fusible F1', description: 'SMD 2A protection',
        confidence: 0.85, severity: 'warning',
        boundingBox: { x: 0.60, y: 0.50, w: 0.08, h: 0.06 },
        action: 'Test continuité: BIP = bon, Silence = grillé',
        testInstruction: 'Mode continuité multimètre sur les 2 pattes',
      },
    ],
    testSteps: [
      {
        stepNumber: 1, title: 'Sécurité',
        instruction: 'Débrancher toute alimentation. Attendre 30 secondes.',
        blackProbePosition: null, redProbePosition: null,
        expectedValue: null, actionIfNormal: null, actionIfAbnormal: null,
      },
      {
        stepNumber: 2, title: 'Test fusible',
        instruction: 'Mettre multimètre en mode continuité (symbole son).',
        blackProbePosition: 'Pin gauche fusible F1',
        redProbePosition: 'Pin droit fusible F1',
        expectedValue: 'BIP sonore = fusible bon',
        actionIfNormal: 'Continuer à l\'étape 3',
        actionIfAbnormal: 'Remplacer fusible F1 (2A)',
      },
      {
        stepNumber: 3, title: 'Tension alimentation',
        instruction: 'Rebrancher. Mode tension DC (V––)',
        blackProbePosition: 'GND - masse carte',
        redProbePosition: 'Point + condensateur C3',
        expectedValue: '3.3V à 5V',
        actionIfNormal: 'Alimentation OK, chercher ailleurs',
        actionIfAbnormal: 'Remplacer condensateur C3 ou régulateur',
      },
    ],
  };
}

module.exports = router;
