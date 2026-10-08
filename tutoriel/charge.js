// Tutoriel k6 — étape 11 « Construire une montée progressive » (page 12)
// Même action que premier-test.js, avec un profil de charge 5 → 10 → 20 → 0 utilisateurs sur 2 minutes.
//   ./bin/k6 run tutoriel/charge.js
import scenario from './premier-test.js';

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '30s', target: 10 },
    { duration: '30s', target: 20 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate==1'],
  },
};

export default scenario;
