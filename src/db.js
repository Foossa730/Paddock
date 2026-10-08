const dns = require('dns');
const mongoose = require('mongoose');

const OPTIONS = { serverSelectionTimeoutMS: 10000 };

// Certaines box internet (dont la Livebox Orange) refusent les requêtes DNS « SRV »
// utilisées par les adresses mongodb+srv://. On réessaie alors avec des DNS publics.
const estErreurDnsSrv = (err) => /querySrv|queryTxt/.test(err && err.message);

function expliquer(err) {
  const msg = (err && err.message) || String(err);
  if (estErreurDnsSrv(err)) {
    return `${msg}\n   → Problème DNS : ta box n'arrive pas à résoudre l'adresse Atlas. ` +
      'Change les DNS du Mac (Réglages Système > Réseau > Wi-Fi > Détails > DNS : 1.1.1.1 et 8.8.8.8) puis relance.';
  }
  if (/bad auth|Authentication failed/i.test(msg)) {
    return `${msg}\n   → Identifiant ou mot de passe refusé : vérifie MONGODB_URI dans .env ` +
      '(Atlas > Security > Database Access pour réinitialiser le mot de passe).';
  }
  if (err && err.name === 'MongooseServerSelectionError') {
    return `${msg}\n   → Atlas ne répond pas : ton adresse IP n'est sûrement pas autorisée. ` +
      'Ajoute-la dans Atlas > Security > Network Access > « Add Current IP Address ».';
  }
  return msg;
}

async function connectDB(uri, dbName) {
  if (!uri) {
    throw new Error('MONGODB_URI manquant : copie .env.example en .env et renseigne ta chaîne de connexion Atlas.');
  }
  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(uri, { dbName, ...OPTIONS });
  } catch (err) {
    if (!estErreurDnsSrv(err)) throw new Error(expliquer(err));
    console.warn('⚠️  Le DNS de ta connexion refuse les requêtes SRV, nouvel essai avec les DNS publics (1.1.1.1, 8.8.8.8)…');
    dns.setServers(['1.1.1.1', '8.8.8.8']);
    try {
      await mongoose.connect(uri, { dbName, ...OPTIONS });
    } catch (err2) {
      throw new Error(expliquer(err2));
    }
  }

  console.log(`✅ Connecté à MongoDB (base "${mongoose.connection.name}")`);
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
