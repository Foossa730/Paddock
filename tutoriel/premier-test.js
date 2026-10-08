// Tutoriel k6 — étape 06 « Comprendre le premier script » (page 07)
// Un utilisateur virtuel appelle une route GET pendant 30 s et vérifie le statut 200.
//   ./bin/k6 run tutoriel/premier-test.js
// Adresse testée : TARGET_URL si elle est définie, sinon la liste des voitures de l'API locale.
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate==1'],
  },
};

const url = __ENV.TARGET_URL ||
  'http://127.0.0.1:3000/api/voitures';

export default function () {
  const response = http.get(url, { timeout: '5s' });
  check(response, {
    'statut 200': (r) => r.status === 200,
  });
  sleep(1);
}
