// Page « Rapports k6 » : liste des rapports + lancement des tests k6 depuis le navigateur.
// Seuls les 3 scénarios du dossier k6/ peuvent être lancés, un seul à la fois, et uniquement depuis ce Mac.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const express = require('express');

const RACINE = path.join(__dirname, '..', '..');
const DOSSIER = path.join(RACINE, 'rapports');
const K6 = path.join(RACINE, 'bin', 'k6');
const API_LOCALE = `http://127.0.0.1:${process.env.PORT || 3000}`;
// Chaque test : script k6, options en ligne de commande, variables, nom du rapport (fixe = remplacé à chaque essai)
const TESTS = {
  // --- Étapes du tutoriel (PDF « Installer k6, ouvrir le dashboard et simuler une charge ») ---
  premier: { groupe: 'tuto', nom: 'Étape 07 · Premier test (1 VU, 30 s)', script: 'tutoriel/premier-test.js', rapport: 'rapport-1vu' },
  '10vu': { groupe: 'tuto', nom: 'Étape 08 · 10 VU pendant 60 s', script: 'tutoriel/premier-test.js', args: ['--vus', '10', '--duration', '60s'], rapport: 'rapport-10vu' },
  progressif: { groupe: 'tuto', nom: 'Étape 12 · Montée 5 → 10 → 20 → 0 VU (2 min)', script: 'tutoriel/charge.js', rapport: 'rapport-progressif' },
  lent: { groupe: 'tuto', nom: 'Étape 15A · Réponse lente (mode=slow)', script: 'tutoriel/premier-test.js', args: ['--vus', '1', '--duration', '30s'], cible: '/api/entrainement?mode=slow', rapport: 'rapport-lent' },
  erreur: { groupe: 'tuto', nom: 'Étape 15B · Réponse en erreur (mode=error)', script: 'tutoriel/premier-test.js', args: ['--vus', '1', '--duration', '30s'], cible: '/api/entrainement?mode=error', rapport: 'rapport-erreur' },
  // --- Tests complets du projet (CRUD) ---
  smoke: { groupe: 'projet', nom: 'Test rapide CRUD (30 s)', script: 'k6/smoke.js' },
  charge: { groupe: 'projet', nom: 'Test de charge CRUD (≈ 2 min)', script: 'k6/charge.js' },
  stress: { groupe: 'projet', nom: 'Test de stress (2 min)', script: 'k6/stress.js' },
};

const router = express.Router();
let execution = null; // { test, debut, fichier, sortie, code, fin }

const local = (req) => {
  const ipLocale = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  // Refuse aussi les requêtes envoyées par un autre site ouvert dans le navigateur
  const origine = req.headers.origin;
  const origineLocale = !origine || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origine);
  return ipLocale && origineLocale;
};
const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sansCouleurs = (t) => t.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

function listerRapports() {
  try {
    return fs.readdirSync(DOSSIER)
      .filter((f) => f.endsWith('.html'))
      .map((f) => ({ f, t: fs.statSync(path.join(DOSSIER, f)).mtime }))
      .sort((a, b) => b.t - a.t);
  } catch {
    return [];
  }
}

router.post('/lancer', express.json(), (req, res) => {
  if (!local(req)) return res.status(403).json({ erreur: 'Lancement autorisé uniquement depuis ce Mac' });
  const test = req.body && req.body.test;
  if (!TESTS[test]) return res.status(400).json({ erreur: `Test inconnu. Choix : ${Object.keys(TESTS).join(', ')}` });
  if (execution && execution.code === undefined) return res.status(409).json({ erreur: 'Un test est déjà en cours' });
  if (!fs.existsSync(K6)) return res.status(500).json({ erreur: 'k6 introuvable dans bin/k6' });

  fs.mkdirSync(DOSSIER, { recursive: true });
  const def = TESTS[test];
  const horodatage = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
  const base = def.rapport || `rapport-${test}-${horodatage}`;
  const fichier = `${base}.html`;
  const env = {
    ...process.env,
    BASE_URL: API_LOCALE,
    K6_NO_USAGE_REPORT: 'true',
    K6_WEB_DASHBOARD: 'true',
    K6_WEB_DASHBOARD_HOST: '127.0.0.1',
    K6_WEB_DASHBOARD_PORT: '5665',
    K6_WEB_DASHBOARD_OPEN: 'false',
    K6_WEB_DASHBOARD_PERIOD: def.groupe === 'tuto' ? '5s' : '2s',
    K6_WEB_DASHBOARD_EXPORT: path.join('rapports', fichier),
  };
  delete env.TARGET_URL;
  if (def.groupe === 'tuto') env.TARGET_URL = API_LOCALE + (def.cible || '/api/voitures');
  const args = ['run', '--no-color', ...(def.args || []), '--summary-export', path.join('rapports', `${base}.json`), def.script];
  execution = { test, debut: new Date(), fichier, sortie: '', code: undefined, cible: env.TARGET_URL || API_LOCALE };

  const enfant = spawn(K6, args, { cwd: RACINE, env });
  const courant = execution;
  const ajouter = (d) => { courant.sortie = (courant.sortie + sansCouleurs(d.toString())).slice(-20000); };
  enfant.stdout.on('data', ajouter);
  enfant.stderr.on('data', ajouter);
  enfant.on('error', (e) => { ajouter(`\nErreur : ${e.message}\n`); courant.code = -1; courant.fin = new Date(); });
  enfant.on('close', (code) => { courant.code = code; courant.fin = new Date(); });

  res.status(202).json({ ok: true, test, fichier });
});

router.get('/etat', (req, res) => {
  if (!execution) return res.json({ enCours: false });
  const e = execution;
  res.json({
    enCours: e.code === undefined,
    test: e.test,
    nom: TESTS[e.test].nom,
    cible: e.cible,
    debut: e.debut,
    fin: e.fin,
    code: e.code,
    reussi: e.code === 0,
    rapport: e.code !== undefined && fs.existsSync(path.join(DOSSIER, e.fichier)) ? `/rapports/${e.fichier}` : null,
    sortie: e.sortie.split('\n').filter((l) => !/^\s*(running|default|lecteurs|editeurs) /.test(l)).slice(-60).join('\n'),
  });
});

router.get('/', (req, res) => {
  const fichiers = listerRapports();
  const lignes = fichiers.length
    ? fichiers.map(({ f, t }) => `<li><a href="/rapports/${encodeURIComponent(f)}">${esc(f.replace(/\.html$/, ''))}</a><span>${t.toLocaleString('fr-FR')}</span></li>`).join('')
    : '<li>Aucun rapport pour l’instant.</li>';
  const boutons = (groupe) => Object.entries(TESTS)
    .filter(([, t]) => t.groupe === groupe)
    .map(([id, t]) => `<button type="button" data-test="${id}">${esc(t.nom)}</button>`)
    .join('');
  res.send(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rapports k6</title>
<style>
body{font:15px/1.5 system-ui,-apple-system,sans-serif;margin:0;padding:32px 16px;background:#f3f4f6;color:#14161a}
main{max-width:760px;margin:auto}h1{margin:0 0 4px}h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#858b97;margin:28px 0 10px}
p{color:#4b515c;margin:0 0 8px}a{color:#e4002b;font-weight:600}
.carte{background:#fff;border:1px solid #e2e4e9;border-radius:12px}
ul{list-style:none;padding:0;margin:0}li{display:flex;justify-content:space-between;gap:12px;padding:12px 16px;border-top:1px solid #e2e4e9}li:first-child{border-top:0}
li span{color:#858b97;font-size:13px;white-space:nowrap}
.boutons{display:flex;flex-wrap:wrap;gap:8px;padding:16px}
button{font:inherit;font-weight:600;border:0;border-radius:8px;padding:10px 16px;background:#e4002b;color:#fff;cursor:pointer}
button:disabled{opacity:.45;cursor:not-allowed}
#etat{padding:0 16px 16px}#etat:empty{display:none}
.statut{font-weight:600;margin:0 0 8px}.ok{color:#1f9d55}.ko{color:#e4002b}
pre{margin:0;max-height:340px;overflow:auto;background:#0e0f12;color:#d7dae0;border-radius:8px;padding:12px;font:12px/1.45 ui-monospace,Menlo,monospace;white-space:pre-wrap}
@media(prefers-color-scheme:dark){body{background:#0e0f12;color:#eceef2}.carte{background:#1a1d23;border-color:#2a2e36}li{border-color:#2a2e36}p{color:#a3a9b5}pre{background:#000}}
</style>
<main>
<h1>Rapports k6</h1><p><a href="/">← Retour au catalogue</a></p>
<h2>Tutoriel k6 — une étape par bouton</h2>
<div class="carte"><div class="boutons">${boutons('tuto')}</div></div>
<h2>Tests complets du projet</h2>
<div class="carte"><div class="boutons">${boutons('projet')}</div><div id="etat"></div></div>
<h2>Rapports enregistrés</h2>
<ul class="carte">${lignes}</ul>
</main>
<script>
const etatEl = document.getElementById('etat');
const boutons = [...document.querySelectorAll('[data-test]')];
let suivi = null;
function afficher(e) {
  boutons.forEach(b => b.disabled = !!e.enCours);
  if (!e.test) { etatEl.innerHTML = ''; return; }
  const duree = Math.round(((e.fin ? new Date(e.fin) : new Date()) - new Date(e.debut)) / 1000);
  let statut;
  if (e.enCours) statut = '<p class="statut">⏳ ' + e.nom + ' en cours… ' + duree + ' s (cible : ' + e.cible + ') — <a href="http://localhost:5665" target="_blank" rel="noopener">voir le tableau de bord en direct</a><br><small>Après 30 s ou 2 min, ferme l’onglet du tableau de bord : k6 attend qu’il soit fermé pour terminer et enregistrer le rapport.</small></p>';
  else if (e.reussi) statut = '<p class="statut ok">✅ ' + e.nom + ' réussi en ' + duree + ' s' + (e.rapport ? ' — <a href="' + e.rapport + '">ouvrir le rapport</a>' : '') + '</p>';
  else statut = '<p class="statut ko">⚠️ ' + e.nom + ' terminé avec des seuils non respectés ou une erreur' + (e.rapport ? ' — <a href="' + e.rapport + '">ouvrir le rapport</a>' : '') + '</p>';
  const pre = document.createElement('pre'); pre.textContent = e.sortie || '';
  etatEl.innerHTML = statut; etatEl.appendChild(pre); pre.scrollTop = pre.scrollHeight;
}
async function rafraichir() {
  const e = await fetch('/rapports/etat').then(r => r.json()).catch(() => ({}));
  afficher(e);
  if (e.enCours && !suivi) suivi = setInterval(rafraichir, 1500);
  if (!e.enCours && suivi) { clearInterval(suivi); suivi = null; if (e.rapport) setTimeout(() => location.reload(), 300); }
}
boutons.forEach(b => b.addEventListener('click', async () => {
  const r = await fetch('/rapports/lancer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ test: b.dataset.test }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { alert(j.erreur || 'Erreur'); return; }
  rafraichir();
}));
rafraichir();
</script></html>`);
});

router.use(express.static(DOSSIER));

module.exports = router;
