const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const voituresRouter = require('./routes/voitures');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();

app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Interface web (dossier public/) servie sur http://localhost:3000/
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rapports k6 : liste, consultation et lancement des tests (voir src/routes/rapports.js)
app.use('/rapports', require('./routes/rapports'));

app.get('/api', (req, res) => {
  res.json({
    api: 'Voitures de sport',
    endpoints: {
      lister: 'GET /api/voitures',
      statistiques: 'GET /api/voitures/stats',
      lire: 'GET /api/voitures/:id',
      creer: 'POST /api/voitures',
      remplacer: 'PUT /api/voitures/:id',
      modifier: 'PATCH /api/voitures/:id',
      supprimer: 'DELETE /api/voitures/:id',
      sante: 'GET /health',
      interface: 'GET /',
      entrainement_k6: 'GET /api/entrainement?mode=slow|error',
    },
  });
});

app.get('/health', (req, res) => {
  const etats = ['déconnecté', 'connecté', 'connexion…', 'déconnexion…'];
  const ok = mongoose.connection.readyState === 1;
  res.status(ok ? 200 : 503).json({ statut: ok ? 'ok' : 'ko', mongodb: etats[mongoose.connection.readyState] });
});

app.use('/api/voitures', voituresRouter);
app.use('/api/entrainement', require('./routes/entrainement')); // tutoriel k6 : ?mode=slow | ?mode=error

app.use(notFound);
app.use(errorHandler);

module.exports = app;
