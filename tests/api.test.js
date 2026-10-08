// Tests de bout en bout sur une base MongoDB en mémoire (ne touche pas à Atlas).
// Lancer avec : npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('../src/app');
const Voiture = require('../src/models/Voiture');
const donnees = require('../data/voitures.json');

let mongod;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: 'test' });
  await Voiture.insertMany(donnees);
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const nouvelle = {
  marque: 'Alpine',
  modele: 'A290',
  annee: 2025,
  pays: 'France',
  categorie: 'Compacte sportive',
  moteur: { energie: 'Électrique', architecture: '1 moteur électrique', puissance_ch: 220, couple_nm: 300 },
  transmission: { boite: 'Rapport unique', rapports: 1, type: 'Traction' },
  performances: { zero_a_cent_s: 6.4, vitesse_max_kmh: 170 },
  poids_kg: 1479,
  prix_eur: 38700,
  places: 5,
};

test('GET /health', async () => {
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.statut, 'ok');
});

test('GET /api/voitures liste paginée', async () => {
  const res = await request(app).get('/api/voitures?limite=5');
  assert.equal(res.status, 200);
  assert.equal(res.body.total, donnees.length);
  assert.equal(res.body.data.length, 5);
  assert.equal(res.body.pages, Math.ceil(donnees.length / 5));
});

test('GET /api/voitures filtres + tri', async () => {
  const res = await request(app).get('/api/voitures?pays=italie&puissance_min=900&tri=-puissance_ch');
  assert.equal(res.status, 200);
  assert.ok(res.body.data.length > 0);
  for (const v of res.body.data) {
    assert.equal(v.pays, 'Italie');
    assert.ok(v.moteur.puissance_ch >= 900);
  }
  const ch = res.body.data.map((v) => v.moteur.puissance_ch);
  assert.deepEqual(ch, [...ch].sort((a, b) => b - a));
});

test('GET /api/voitures recherche texte', async () => {
  const res = await request(app).get('/api/voitures?q=911');
  assert.equal(res.body.total, 2);
});

test('GET /api/voitures tri invalide -> 400', async () => {
  const res = await request(app).get('/api/voitures?tri=couleur');
  assert.equal(res.status, 400);
});

test('GET /api/voitures/stats', async () => {
  const res = await request(app).get('/api/voitures/stats');
  assert.equal(res.status, 200);
  assert.equal(res.body.global.total, donnees.length);
  assert.ok(res.body.par_marque.length > 0);
});

test('CRUD complet', async () => {
  // CREATE
  const cree = await request(app).post('/api/voitures').send(nouvelle);
  assert.equal(cree.status, 201);
  const id = cree.body._id;
  assert.equal(cree.body.rapport_poids_puissance_kg_ch, 6.72);

  // doublon -> 409
  const doublon = await request(app).post('/api/voitures').send(nouvelle);
  assert.equal(doublon.status, 409);

  // READ
  const lu = await request(app).get(`/api/voitures/${id}`);
  assert.equal(lu.status, 200);
  assert.equal(lu.body.modele, 'A290');

  // PATCH : seul un sous-champ change, le reste de "moteur" est conservé
  const patch = await request(app).patch(`/api/voitures/${id}`).send({ moteur: { puissance_ch: 250 } });
  assert.equal(patch.status, 200);
  assert.equal(patch.body.moteur.puissance_ch, 250);
  assert.equal(patch.body.moteur.couple_nm, 300);
  assert.equal(patch.body.rapport_poids_puissance_kg_ch, 5.92);

  // PUT : remplacement complet
  const put = await request(app).put(`/api/voitures/${id}`).send({ ...nouvelle, modele: 'A290 GTS', prix_eur: 41000 });
  assert.equal(put.status, 200);
  assert.equal(put.body.modele, 'A290 GTS');
  assert.equal(put.body.moteur.puissance_ch, 220);

  // DELETE
  const del = await request(app).delete(`/api/voitures/${id}`);
  assert.equal(del.status, 204);
  const absent = await request(app).get(`/api/voitures/${id}`);
  assert.equal(absent.status, 404);
});

test('Validation -> 400', async () => {
  const res = await request(app).post('/api/voitures').send({ marque: 'Test' });
  assert.equal(res.status, 400);
  assert.ok(res.body.details.modele);
  assert.ok(res.body.details['moteur.puissance_ch']);
});

test('Id invalide -> 400, route inconnue -> 404', async () => {
  assert.equal((await request(app).get('/api/voitures/abc')).status, 400);
  assert.equal((await request(app).get('/api/inconnu')).status, 404);
});
