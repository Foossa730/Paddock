# API Voitures de sport 🏎️

API REST CRUD (Node.js + Express + Mongoose) branchée sur MongoDB Atlas.

- **Cluster** : `Cluster0` (projet « Project 0 »)
- **Base** : `sportscars` — **Collection** : `voitures` (33 voitures déjà importées)
- Visible dans **MongoDB Compass** en te connectant avec la même chaîne `mongodb+srv://…cluster0.pq5gwcd.mongodb.net`

## Démarrage

```bash
npm install
cp .env.example .env      # puis mets ton mot de passe Atlas dans MONGODB_URI
npm run dev               # http://localhost:3000
```

### Si `npm run dev` échoue

Le message utile est la ligne `❌ Démarrage impossible : …` affichée juste au-dessus de « Failed running ».

| Message | Cause | Solution |
|---|---|---|
| `querySrv ECONNREFUSED` / `ETIMEOUT` | Le DNS de la box refuse les adresses `mongodb+srv` (fréquent avec la Livebox) | L'API réessaie seule avec 1.1.1.1 / 8.8.8.8. Si ça échoue encore : Réglages Système > Réseau > Wi-Fi > Détails > DNS → ajoute `1.1.1.1` et `8.8.8.8` |
| `bad auth` / `Authentication failed` | Mot de passe incorrect dans `.env` | Atlas > Security > Database Access → réinitialise le mot de passe |
| `MongooseServerSelectionError` | Ton IP n'est pas autorisée | Atlas > Security > Network Access → « Add Current IP Address » |

## Interface web

Ouvre **http://localhost:3000** une fois l'API lancée (double-clic sur `1-Lancer-API.command`) :

- statistiques (nombre de voitures, puissance et prix moyens, vitesse record) et répartition par énergie / catégorie (clique sur une barre pour filtrer) ;
- catalogue avec recherche, filtres (pays, catégorie, énergie, puissance) et tris ;
- fiche détaillée de chaque voiture ;
- ajout, modification et suppression (double confirmation).

Fichiers : `public/index.html`, `public/styles.css`, `public/app.js` (aucune dépendance).
La description JSON de l'API est maintenant sur `/api`.

## Endpoints

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/voitures` | Liste paginée, filtrable et triable |
| GET | `/api/voitures/stats` | Statistiques globales, par marque, catégorie et énergie |
| GET | `/api/voitures/:id` | Une voiture |
| POST | `/api/voitures` | Créer (201, ou 409 si marque+modèle+année existe déjà) |
| PUT | `/api/voitures/:id` | Remplacer entièrement |
| PATCH | `/api/voitures/:id` | Modifier certains champs (sous-champs compris) |
| DELETE | `/api/voitures/:id` | Supprimer (204) |
| GET | `/health` | État de la connexion MongoDB |

### Paramètres de `GET /api/voitures`

| Paramètre | Exemple | Effet |
|---|---|---|
| `marque`, `pays`, `categorie` | `pays=italie` | Égalité, insensible à la casse |
| `energie` | `energie=Hybride` | Essence / Hybride / Électrique / Diesel |
| `transmission` | `transmission=Intégrale` | Propulsion / Traction / Intégrale |
| `en_production` | `en_production=true` | |
| `q` | `q=911` | Recherche dans marque et modèle |
| `puissance_min/max`, `prix_min/max`, `annee_min/max` | `puissance_min=700` | Intervalles |
| `tri` | `tri=-puissance_ch,prix_eur` | `-` = décroissant |
| `page`, `limite` | `page=2&limite=10` | 20 par défaut, 100 max |

Champs triables : `marque`, `modele`, `annee`, `puissance_ch`, `couple_nm`, `zero_a_cent_s`, `vitesse_max_kmh`, `poids_kg`, `rapport_poids_puissance_kg_ch`, `prix_eur`.

## Exemples

```bash
# Les 5 plus puissantes
curl "http://localhost:3000/api/voitures?tri=-puissance_ch&limite=5"

# Italiennes hybrides
curl "http://localhost:3000/api/voitures?pays=italie&energie=hybride"

# Créer
curl -X POST http://localhost:3000/api/voitures -H "Content-Type: application/json" -d '{
  "marque": "Alpine", "modele": "A290", "annee": 2025, "pays": "France", "categorie": "Compacte sportive",
  "moteur": { "energie": "Électrique", "puissance_ch": 220, "couple_nm": 300 },
  "transmission": { "boite": "Rapport unique", "rapports": 1, "type": "Traction" },
  "performances": { "zero_a_cent_s": 6.4, "vitesse_max_kmh": 170 },
  "poids_kg": 1479, "prix_eur": 38700, "places": 5
}'

# Modifier seulement la puissance
curl -X PATCH http://localhost:3000/api/voitures/<id> -H "Content-Type: application/json" -d '{"moteur": {"puissance_ch": 250}}'

# Supprimer
curl -X DELETE http://localhost:3000/api/voitures/<id>
```

## Modèle d'une voiture

```json
{
  "marque": "Porsche",
  "modele": "911 GT3 (992)",
  "annee": 2022,
  "pays": "Allemagne",
  "categorie": "Sportive",
  "moteur": { "energie": "Essence", "architecture": "Flat-6 atmosphérique", "cylindree_cc": 3996, "puissance_ch": 510, "couple_nm": 470 },
  "transmission": { "boite": "PDK", "rapports": 7, "type": "Propulsion" },
  "performances": { "zero_a_cent_s": 3.4, "vitesse_max_kmh": 318 },
  "poids_kg": 1435,
  "rapport_poids_puissance_kg_ch": 2.81,
  "prix_eur": 197000,
  "places": 2,
  "en_production": true
}
```

Obligatoires : `marque`, `modele`, `annee`, `moteur.puissance_ch`.
`rapport_poids_puissance_kg_ch` est calculé automatiquement ; `createdAt`/`updatedAt` sont gérés par l'API.

## Données

- `data/voitures.json` et `data/voitures.csv` : le dataset (33 voitures, specs constructeur approximatives, prix indicatifs en €)
- `npm run seed` : importe le dataset si la collection est vide
- `npm run seed:reset` : vide la collection et réimporte tout
- `scripts/build_dataset.py` : régénère les fichiers JSON/CSV

## Tests

```bash
npm test
```

Les tests tournent sur une base MongoDB en mémoire et ne touchent pas à Atlas.

## Tests de performance avec k6

### k6

k6 v1.3.0 pour Mac (Apple Silicon) est fourni dans `bin/k6` (binaire officiel Grafana,
SHA-256 de l'archive vérifié). Les commandes `npm run k6:*` l'utilisent directement :
rien d'autre à installer.

Pour l'avoir aussi partout dans le Terminal : `brew install k6`, puis `k6 version`.
Autres systèmes : voir le [guide d'installation k6](https://grafana.com/docs/learning-paths/run-first-k6-test/install-k6/).

### Lancer un test avec le tableau de bord web

Démarre l'API dans un terminal (`npm run dev`), puis dans un autre :

| Commande | Scénario | Durée |
|---|---|---|
| `npm run k6:smoke` | 1 utilisateur, vérifie toutes les routes et les erreurs attendues | 30 s |
| `npm run k6:charge` | 10 lecteurs simultanés + 1 cycle CRUD/s | ~2 min |
| `npm run k6:stress` | Montée jusqu'à 50 utilisateurs en lecture, arrêt auto si > 5 % d'erreurs | 2 min |

Le tableau de bord k6 s'ouvre automatiquement sur **http://localhost:5665** et affiche en direct
requêtes/s, temps de réponse, erreurs et utilisateurs virtuels. À la fin, un rapport HTML autonome
est enregistré dans `rapports/` (ex. `rapports/rapport-charge.html`).

Pour viser une autre adresse : `BASE_URL=https://mon-api.example.com npm run k6:charge`.

### Ce qui est vérifié

- **Lectures** : liste avec filtres et tris aléatoires, lecture par id, statistiques
- **Cycle CRUD** : POST → GET → PATCH (sous-champ) → PUT → DELETE → GET (404)
- **Seuils** (le test échoue s'ils ne sont pas tenus) : < 1 % d'erreurs, p95 < 500 ms sur la liste,
  < 300 ms sur la lecture par id, < 800 ms sur la création
- Les voitures créées par k6 ont la marque `K6-TEST` et sont supprimées à la fin du test, même s'il est interrompu.

> Le cluster Atlas gratuit (M0) limite le débit : les volumes sont volontairement modérés.
> Si les seuils échouent, c'est souvent la latence réseau vers Atlas (région Paris) et non l'API.

## Structure

```
src/
  app.js                         # Express, routes, gestion d'erreurs
  server.js                      # connexion MongoDB + démarrage
  db.js
  models/Voiture.js              # schéma + validations
  controllers/voitures.controller.js
  routes/voitures.js
  middleware/errors.js
scripts/seed.js
tests/api.test.js
k6/lib.js, smoke.js, charge.js, stress.js   # tests de performance
rapports/                                   # rapports HTML k6
data/voitures.json, voitures.csv
```
# Paddock
