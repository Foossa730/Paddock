// Test de stress : monte progressivement en lecture pour trouver le point de rupture.
//   k6 run k6/stress.js
// ⚠️ Sur un cluster Atlas gratuit (M0), garde des paliers raisonnables.
import { sleep } from 'k6';
import { verifierApi, listerAvecFiltres, lireUne } from './lib.js';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '30s', target: 25 },
    { duration: '30s', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    // le test s'arrête de lui-même si l'API se dégrade trop
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '10s' }],
    http_req_duration: ['p(95)<1000'],
  },
};

export function setup() {
  return { ids: verifierApi() };
}

export default function ({ ids }) {
  listerAvecFiltres();
  lireUne(ids[Math.floor(Math.random() * ids.length)]);
  sleep(0.3);
}
