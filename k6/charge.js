// Test de charge : trafic réaliste (beaucoup de lectures, quelques écritures).
//   k6 run k6/charge.js
// Volumes volontairement modérés : le cluster Atlas gratuit (M0) a des limites de débit.
import { sleep } from 'k6';
import { verifierApi, listerAvecFiltres, lireUne, statistiques, cycleCrud, nettoyer } from './lib.js';

export const options = {
  scenarios: {
    lecteurs: {
      executor: 'ramping-vus',
      exec: 'lecteur',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 }, // montée
        { duration: '1m', target: 10 }, // plateau
        { duration: '20s', target: 0 }, // descente
      ],
    },
    editeurs: {
      executor: 'constant-arrival-rate',
      exec: 'editeur',
      rate: 1, // 1 cycle CRUD par seconde
      timeUnit: '1s',
      duration: '1m30s',
      startTime: '10s',
      preAllocatedVUs: 3,
      maxVUs: 10,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    'http_req_duration{name:GET /api/voitures}': ['p(95)<500'],
    'http_req_duration{name:GET /api/voitures/:id}': ['p(95)<300'],
    'http_req_duration{name:POST /api/voitures}': ['p(95)<800'],
    duree_cycle_crud: ['p(95)<3000'],
  },
};

export function setup() {
  return { ids: verifierApi() };
}

export function lecteur({ ids }) {
  listerAvecFiltres();
  sleep(0.5 + Math.random());
  lireUne(ids[Math.floor(Math.random() * ids.length)]);
  sleep(0.5 + Math.random());
  if (Math.random() < 0.2) statistiques();
}

export function editeur() {
  cycleCrud();
}

export function teardown() {
  nettoyer();
}
