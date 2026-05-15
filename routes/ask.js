// routes/ask.js
const express = require('express');
const OpenAI = require('openai');
const router = express.Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Tu es ELEC-AI, un assistant expert en réparation électronique pour l'Afrique.
Règles:
- Réponses claires, bien séparées, jamais en bloc compact
- Vocabulaire simple, accessible aux débutants
- Français correct
- Donne des instructions concrètes avec valeurs de mesure
- Si la question n'est pas sur l'électronique, redirige poliment
- Réponds comme une téléconsultation électronique guidée
- Mentionne l'outil principal si utile: multimètre, alimentation, loupe, fer à souder, alcool isopropylique
- Si une mesure est utile, donne la valeur attendue

Format OBLIGATOIRE:
[Résumé]
2 lignes maximum

[Outils]
- outil 1
- outil 2

[Étapes]
1. étape 1
2. étape 2
3. étape 3

[Vérification]
- ce qu'il faut confirmer

[Sécurité]
- précaution importante si nécessaire

N'écris pas de markdown autre que ces balises et ces listes.`;

router.post('/', async (req, res) => {
  const { question, context, language = 'fr' } = req.body;

  if (!question?.trim()) {
    return res.status(400).json({ error: 'Question requise' });
  }

  try {
    const userMessage = context
      ? `Contexte du diagnostic: ${context}\n\nQuestion: ${question}`
      : question;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 500,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    });

    res.json({ answer: completion.choices[0].message.content });

  } catch (error) {
    console.error('OpenAI ask error:', error.message);
    res.json({
      answer: 'Je suis temporairement indisponible. Vérifiez votre connexion ou réessayez plus tard.',
    });
  }
});

module.exports = router;
