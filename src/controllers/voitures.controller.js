const mongoose = require('mongoose');
const Voiture = require('../models/Voiture');
const { HttpError } = require('../middleware/errors');

// Champs triables : nom public -> chemin MongoDB
const CHAMPS_TRI = {
  marque: 'marque',
  modele: 'modele',
  annee: 'annee',
  puissance_ch: 'moteur.puissance_ch',
  couple_nm: 'moteur.couple_nm',
  zero_a_cent_s: 'performances.zero_a_cent_s',
  vitesse_max_kmh: 'performances.vitesse_max_kmh',
  poids_kg: 'poids_kg',
  rapport_poids_puissance_kg_ch: 'rapport_poids_puissance_kg_ch',
  prix_eur: 'prix_eur',
};

// Champs qu'un client n'a pas le droit d'écrire
const CHAMPS_PROTEGES = ['_id', 'createdAt', 'updatedAt', 'rapport_poids_puissance_kg_ch'];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function nombre(valeur, nom) {
  if (valeur === undefined || valeur === '') return undefined;
  const n = Number(valeur);
  if (Number.isNaN(n)) throw new HttpError(400, `Le paramètre "${nom}" doit être un nombre`);
  return n;
}

function intervalle(filtre, chemin, min, max) {
  if (min === undefined && max === undefined) return;
  filtre[chemin] = {};
  if (min !== undefined) filtre[chemin].$gte = min;
  if (max !== undefined) filtre[chemin].$lte = max;
}

function egalInsensible(valeur) {
  return { $regex: `^${escapeRegex(valeur)}$`, $options: 'i' };
}

function construireFiltre(q) {
  const filtre = {};
  if (q.marque) filtre.marque = egalInsensible(q.marque);
  if (q.pays) filtre.pays = egalInsensible(q.pays);
  if (q.categorie) filtre.categorie = egalInsensible(q.categorie);
  if (q.energie) filtre['moteur.energie'] = egalInsensible(q.energie);
  if (q.transmission) filtre['transmission.type'] = egalInsensible(q.transmission);
  if (q.en_production !== undefined) {
    if (!['true', 'false'].includes(q.en_production)) {
      throw new HttpError(400, 'Le paramètre "en_production" doit valoir true ou false');
    }
    filtre.en_production = q.en_production === 'true';
  }
  if (q.q) {
    const re = { $regex: escapeRegex(q.q), $options: 'i' };
    filtre.$or = [{ marque: re }, { modele: re }];
  }
  intervalle(filtre, 'moteur.puissance_ch', nombre(q.puissance_min, 'puissance_min'), nombre(q.puissance_max, 'puissance_max'));
  intervalle(filtre, 'prix_eur', nombre(q.prix_min, 'prix_min'), nombre(q.prix_max, 'prix_max'));
  intervalle(filtre, 'annee', nombre(q.annee_min, 'annee_min'), nombre(q.annee_max, 'annee_max'));
  return filtre;
}

function construireTri(tri) {
  if (!tri) return { marque: 1, modele: 1 };
  const sort = {};
  for (const morceau of String(tri).split(',')) {
    const desc = morceau.startsWith('-');
    const nom = morceau.replace(/^[-+]/, '').trim();
    const chemin = CHAMPS_TRI[nom];
    if (!chemin) {
      throw new HttpError(400, `Tri impossible sur "${nom}". Champs triables : ${Object.keys(CHAMPS_TRI).join(', ')}`);
    }
    sort[chemin] = desc ? -1 : 1;
  }
  return sort;
}

function nettoyerCorps(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Le corps de la requête doit être un objet JSON');
  }
  const copie = { ...body };
  for (const champ of CHAMPS_PROTEGES) delete copie[champ];
  return copie;
}

// Transforme { moteur: { puissance_ch: 700 } } en { 'moteur.puissance_ch': 700 }
// pour qu'un PATCH ne modifie que les sous-champs envoyés.
function aplatir(obj, prefixe = '', resultat = {}) {
  for (const [cle, valeur] of Object.entries(obj)) {
    const chemin = prefixe ? `${prefixe}.${cle}` : cle;
    if (valeur && typeof valeur === 'object' && !Array.isArray(valeur)) aplatir(valeur, chemin, resultat);
    else resultat[chemin] = valeur;
  }
  return resultat;
}

async function trouverParId(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, `Identifiant invalide : ${id}`);
  const voiture = await Voiture.findById(id);
  if (!voiture) throw new HttpError(404, `Aucune voiture avec l'id ${id}`);
  return voiture;
}

async function verifierDoublon({ marque, modele, annee }, idExclu) {
  if (!marque || !modele || !annee) return;
  const filtre = { marque: egalInsensible(marque), modele: egalInsensible(modele), annee };
  if (idExclu) filtre._id = { $ne: idExclu };
  const existe = await Voiture.exists(filtre);
  if (existe) throw new HttpError(409, `${marque} ${modele} (${annee}) existe déjà`, { id: existe._id });
}

exports._internes = { construireFiltre, construireTri, aplatir, nettoyerCorps };

// ----- Handlers -----

exports.lister = async (req, res) => {
  const filtre = construireFiltre(req.query);
  const sort = construireTri(req.query.tri);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limite = Math.min(100, Math.max(1, parseInt(req.query.limite, 10) || 20));

  const [total, data] = await Promise.all([
    Voiture.countDocuments(filtre),
    Voiture.find(filtre).sort(sort).skip((page - 1) * limite).limit(limite).lean(),
  ]);

  res.json({ total, page, limite, pages: Math.ceil(total / limite), data });
};

exports.lire = async (req, res) => {
  const voiture = await trouverParId(req.params.id);
  res.json(voiture);
};

exports.creer = async (req, res) => {
  const corps = nettoyerCorps(req.body);
  await verifierDoublon(corps);
  const voiture = await Voiture.create(corps);
  res.status(201).location(`/api/voitures/${voiture._id}`).json(voiture);
};

// PUT : remplace entièrement le document (les champs absents sont supprimés)
exports.remplacer = async (req, res) => {
  const corps = nettoyerCorps(req.body);
  const voiture = await trouverParId(req.params.id);
  await verifierDoublon(corps, voiture._id);
  voiture.overwrite({ ...corps, createdAt: voiture.createdAt });
  await voiture.save();
  res.json(voiture);
};

// PATCH : ne modifie que les champs envoyés (sous-champs compris)
exports.modifier = async (req, res) => {
  const corps = nettoyerCorps(req.body);
  const voiture = await trouverParId(req.params.id);
  for (const [chemin, valeur] of Object.entries(aplatir(corps))) voiture.set(chemin, valeur);
  await verifierDoublon(voiture, voiture._id);
  await voiture.save();
  res.json(voiture);
};

exports.supprimer = async (req, res) => {
  const voiture = await trouverParId(req.params.id);
  await voiture.deleteOne();
  res.status(204).end();
};

exports.stats = async (req, res) => {
  const [global] = await Voiture.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        puissance_moyenne_ch: { $avg: '$moteur.puissance_ch' },
        prix_moyen_eur: { $avg: '$prix_eur' },
        vitesse_max_record_kmh: { $max: '$performances.vitesse_max_kmh' },
      },
    },
    { $project: { _id: 0 } },
  ]);

  const parGroupe = (champ) =>
    Voiture.aggregate([
      {
        $group: {
          _id: `$${champ}`,
          nombre: { $sum: 1 },
          puissance_moyenne_ch: { $avg: '$moteur.puissance_ch' },
          prix_moyen_eur: { $avg: '$prix_eur' },
        },
      },
      { $sort: { nombre: -1, _id: 1 } },
      {
        $project: {
          _id: 0,
          valeur: '$_id',
          nombre: 1,
          puissance_moyenne_ch: { $round: ['$puissance_moyenne_ch', 0] },
          prix_moyen_eur: { $round: ['$prix_moyen_eur', 0] },
        },
      },
    ]);

  const [parMarque, parCategorie, parEnergie] = await Promise.all([
    parGroupe('marque'),
    parGroupe('categorie'),
    parGroupe('moteur.energie'),
  ]);

  const g = global || { total: 0 };
  if (g.puissance_moyenne_ch) g.puissance_moyenne_ch = Math.round(g.puissance_moyenne_ch);
  if (g.prix_moyen_eur) g.prix_moyen_eur = Math.round(g.prix_moyen_eur);

  res.json({ global: g, par_marque: parMarque, par_categorie: parCategorie, par_energie: parEnergie });
};
