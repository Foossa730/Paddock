const mongoose = require('mongoose');

const ENERGIES = ['Essence', 'Hybride', 'Électrique', 'Diesel'];
const TRANSMISSIONS = ['Propulsion', 'Traction', 'Intégrale'];

const voitureSchema = new mongoose.Schema(
  {
    marque: { type: String, required: [true, 'La marque est obligatoire'], trim: true },
    modele: { type: String, required: [true, 'Le modèle est obligatoire'], trim: true },
    annee: {
      type: Number,
      required: [true, "L'année est obligatoire"],
      min: [1886, "L'année doit être ≥ 1886"],
      max: [2100, "L'année doit être ≤ 2100"],
    },
    pays: { type: String, trim: true },
    categorie: { type: String, trim: true },
    moteur: {
      energie: { type: String, enum: { values: ENERGIES, message: `energie doit valoir : ${ENERGIES.join(', ')}` } },
      architecture: { type: String, trim: true },
      cylindree_cc: { type: Number, min: 0, default: null },
      puissance_ch: { type: Number, required: [true, 'moteur.puissance_ch est obligatoire'], min: [1, 'La puissance doit être > 0'] },
      couple_nm: { type: Number, min: 0 },
    },
    transmission: {
      boite: { type: String, trim: true },
      rapports: { type: Number, min: 1 },
      type: { type: String, enum: { values: TRANSMISSIONS, message: `transmission.type doit valoir : ${TRANSMISSIONS.join(', ')}` } },
    },
    performances: {
      zero_a_cent_s: { type: Number, min: 0 },
      vitesse_max_kmh: { type: Number, min: 0 },
    },
    poids_kg: { type: Number, min: [1, 'Le poids doit être > 0'] },
    rapport_poids_puissance_kg_ch: { type: Number },
    prix_eur: { type: Number, min: 0 },
    places: { type: Number, min: 1, max: 9 },
    en_production: { type: Boolean, default: true },
  },
  {
    collection: 'voitures',
    timestamps: true,
    versionKey: false,
    autoIndex: false, // les index sont gérés directement dans Atlas
  }
);

// Le rapport poids/puissance est toujours recalculé à partir du poids et de la puissance
voitureSchema.pre('validate', function () {
  const poids = this.poids_kg;
  const ch = this.moteur && this.moteur.puissance_ch;
  this.rapport_poids_puissance_kg_ch = poids && ch ? Math.round((poids / ch) * 100) / 100 : undefined;
});

module.exports = mongoose.model('Voiture', voitureSchema);
module.exports.ENERGIES = ENERGIES;
module.exports.TRANSMISSIONS = TRANSMISSIONS;
