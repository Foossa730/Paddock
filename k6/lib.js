// Fonctions partagées par les scénarios k6
import http from 'k6/http';
import { check, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';

export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const API = `${BASE_URL}/api/voitures`;
export const PREFIXE_TEST = 'K6-TEST';

const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

export const voituresCreees = new Counter('voitures_creees');
export const dureeCycleCrud = new Trend('duree_cycle_crud', true);

const PAYS = ['italie', 'allemagne', 'royaume-uni', 'japon', 'france', 'états-unis'];
const ENERGIES = ['Essence', 'Hybride', 'Électrique'];
const TRIS = ['-puissance_ch', 'prix_eur', '-vitesse_max_kmh', 'zero_a_cent_s', 'annee'];

const auHasard = (liste) => liste[Math.floor(Math.random() * liste.length)];

// Vérifie que l'API répond avant de lancer le test
export function verifierApi() {
  const res = http.get(`${BASE_URL}/health`, { tags: { name: 'GET /health' } });
  if (res.status !== 200) {
    throw new Error(`API injoignable sur ${BASE_URL} (statut ${res.status}). Lance d'abord "npm run dev".`);
  }
  const liste = http.get(`${API}?limite=100`, { tags: { name: 'GET /api/voitures' } });
  return liste.json('data').map((v) => v._id);
}

// Construit une voiture de test unique (supprimée à la fin du cycle)
export function voitureDeTest() {
  return {
    marque: PREFIXE_TEST,
    modele: `${PREFIXE_TEST} VU${__VU}-IT${__ITER}-${Date.now()}`,
    annee: 2026,
    pays: 'France',
    categorie: 'Sportive',
    moteur: { energie: 'Essence', architecture: 'V6 biturbo', cylindree_cc: 2992, puissance_ch: 600, couple_nm: 700 },
    transmission: { boite: 'Double embrayage', rapports: 8, type: 'Propulsion' },
    performances: { zero_a_cent_s: 3.2, vitesse_max_kmh: 310 },
    poids_kg: 1500,
    prix_eur: 200000,
    places: 2,
  };
}

// --- Lectures ---

export function listerAvecFiltres() {
  const params = [`tri=${auHasard(TRIS)}`, `limite=${auHasard([5, 10, 20])}`];
  if (Math.random() < 0.5) params.push(`pays=${encodeURIComponent(auHasard(PAYS))}`);
  if (Math.random() < 0.3) params.push(`energie=${encodeURIComponent(auHasard(ENERGIES))}`);
  if (Math.random() < 0.3) params.push(`puissance_min=${auHasard([300, 500, 700, 900])}`);

  const res = http.get(`${API}?${params.join('&')}`, { tags: { name: 'GET /api/voitures' } });
  check(res, {
    'liste : statut 200': (r) => r.status === 200,
    'liste : contient data[]': (r) => Array.isArray(r.json('data')),
  });
  return res;
}

export function lireUne(id) {
  const res = http.get(`${API}/${id}`, { tags: { name: 'GET /api/voitures/:id' } });
  check(res, {
    'lecture : statut 200': (r) => r.status === 200,
    'lecture : bon id': (r) => r.json('_id') === id,
  });
  return res;
}

export function statistiques() {
  const res = http.get(`${API}/stats`, { tags: { name: 'GET /api/voitures/stats' } });
  check(res, {
    'stats : statut 200': (r) => r.status === 200,
    'stats : total > 0': (r) => r.json('global.total') > 0,
  });
  return res;
}

// --- Cycle d'écriture complet : POST -> GET -> PATCH -> PUT -> DELETE -> GET (404) ---

export function cycleCrud() {
  const debut = Date.now();
  const voiture = voitureDeTest();
  let id;

  group('CRUD', () => {
    const cree = http.post(API, JSON.stringify(voiture), { ...JSON_HEADERS, tags: { name: 'POST /api/voitures' } });
    const okCree = check(cree, {
      'création : statut 201': (r) => r.status === 201,
      'création : rapport poids/puissance calculé': (r) => r.json('rapport_poids_puissance_kg_ch') === 2.5,
    });
    if (!okCree) return;
    id = cree.json('_id');
    voituresCreees.add(1);

    lireUne(id);

    const patch = http.patch(`${API}/${id}`, JSON.stringify({ moteur: { puissance_ch: 750 } }), {
      ...JSON_HEADERS,
      tags: { name: 'PATCH /api/voitures/:id' },
    });
    check(patch, {
      'patch : statut 200': (r) => r.status === 200,
      'patch : puissance modifiée': (r) => r.json('moteur.puissance_ch') === 750,
      'patch : couple conservé': (r) => r.json('moteur.couple_nm') === 700,
    });

    const put = http.put(`${API}/${id}`, JSON.stringify({ ...voiture, prix_eur: 210000 }), {
      ...JSON_HEADERS,
      tags: { name: 'PUT /api/voitures/:id' },
    });
    check(put, {
      'put : statut 200': (r) => r.status === 200,
      'put : prix remplacé': (r) => r.json('prix_eur') === 210000,
    });

    const del = http.del(`${API}/${id}`, null, { tags: { name: 'DELETE /api/voitures/:id' } });
    check(del, { 'suppression : statut 204': (r) => r.status === 204 });

    const absent = http.get(`${API}/${id}`, {
      tags: { name: 'GET /api/voitures/:id (supprimée)' },
      responseCallback: http.expectedStatuses(404),
    });
    check(absent, { 'après suppression : 404': (r) => r.status === 404 });
  });

  dureeCycleCrud.add(Date.now() - debut);
}

// Supprime les voitures de test restées en base (test interrompu, échec…)
export function nettoyer() {
  const res = http.get(`${API}?marque=${encodeURIComponent(PREFIXE_TEST)}&limite=100`, { tags: { name: 'nettoyage' } });
  const restes = res.status === 200 ? res.json('data') : [];
  for (const v of restes) http.del(`${API}/${v._id}`, null, { tags: { name: 'nettoyage' } });
  if (restes.length) console.log(`🧹 ${restes.length} voiture(s) de test supprimée(s)`);
}
