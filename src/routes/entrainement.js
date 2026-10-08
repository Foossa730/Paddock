// Route d'entraînement pour le tutoriel k6 (étape 15 « lenteur ou erreur ? »).
// Elle ne lit ni n'écrit aucune voiture.
//   GET /api/entrainement              -> 200 immédiat
//   GET /api/entrainement?mode=slow    -> 200 après une attente volontaire de 700 ms
//   GET /api/entrainement?mode=error   -> 500 immédiat (erreur simulée)
const express = require('express');

const router = express.Router();
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

router.get('/', async (req, res) => {
  const mode = req.query.mode || 'normal';
  if (mode === 'slow') {
    await attendre(700);
    return res.json({ statut: 'ok', mode, attente_ms: 700, message: 'Réponse correcte mais volontairement lente' });
  }
  if (mode === 'error') {
    return res.status(500).json({ erreur: 'Erreur simulée pour le tutoriel (mode=error)', mode });
  }
  res.json({ statut: 'ok', mode: 'normal', message: 'Route d’entraînement k6' });
});

module.exports = router;
