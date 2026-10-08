// Test de fumée : 1 utilisateur pendant 30 s, vérifie que toutes les routes répondent correctement.
// (30 s minimum : en dessous, k6 n'a pas assez de données pour le tableau de bord et le rapport HTML)
//   k6 run k6/smoke.js
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { API, verifierApi, listerAvecFiltres, lireUne, statistiques, cycleCrud, nettoyer } from './lib.js';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    checks: ['rate==1.0'], // aucune vérification ne doit échouer
    http_req_failed: ['rate==0'],
    http_req_duration: ['p(95)<1500'],
  },
};

export function setup() {
  return { ids: verifierApi() };
}

export default function ({ ids }) {
  group('Lectures', () => {
    listerAvecFiltres();
    lireUne(ids[__ITER % ids.length]);
    statistiques();
  });

  cycleCrud();

  group('Erreurs attendues', () => {
    const attendu = { responseCallback: http.expectedStatuses(400, 404) };
    check(http.get(`${API}/pas-un-id`, { ...attendu, tags: { name: 'erreur id invalide' } }), {
      'id invalide : 400': (r) => r.status === 400,
    });
    check(http.get(`${API}?tri=couleur`, { ...attendu, tags: { name: 'erreur tri invalide' } }), {
      'tri invalide : 400': (r) => r.status === 400,
    });
    check(
      http.post(API, JSON.stringify({ marque: 'Incomplète' }), {
        ...attendu,
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'erreur validation' },
      }),
      { 'validation : 400': (r) => r.status === 400 }
    );
    check(http.get(`${API}/000000000000000000000000`, { ...attendu, tags: { name: 'erreur introuvable' } }), {
      'introuvable : 404': (r) => r.status === 404,
    });
  });

  sleep(1);
}

export function teardown() {
  nettoyer();
}
