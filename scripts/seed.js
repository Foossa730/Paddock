// Importe data/voitures.json dans la collection "voitures".
//   npm run seed         -> n'importe que si la collection est vide
//   npm run seed:reset   -> vide la collection puis réimporte tout
require('dotenv').config();
const path = require('path');
const { connectDB, disconnectDB } = require('../src/db');
const Voiture = require('../src/models/Voiture');

const reset = process.argv.includes('--reset');

(async () => {
  try {
    await connectDB(process.env.MONGODB_URI, process.env.DB_NAME || 'sportscars');
    const donnees = require(path.join(__dirname, '..', 'data', 'voitures.json'));

    const existant = await Voiture.countDocuments();
    if (existant > 0 && !reset) {
      console.log(`ℹ️  La collection contient déjà ${existant} voitures. Utilise "npm run seed:reset" pour tout réimporter.`);
    } else {
      if (reset) {
        const { deletedCount } = await Voiture.deleteMany({});
        console.log(`🗑️  ${deletedCount} voitures supprimées`);
      }
      const inserees = await Voiture.insertMany(donnees);
      console.log(`✅ ${inserees.length} voitures importées`);
    }
  } catch (err) {
    console.error('❌', err.message);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
})();
