require('dotenv').config();
const app = require('./app');
const { connectDB, disconnectDB } = require('./db');

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await connectDB(process.env.MONGODB_URI, process.env.DB_NAME || 'sportscars');
    const server = app.listen(PORT, () => {
      console.log(`🏎️  API voitures en écoute sur http://localhost:${PORT}`);
    });

    server.on('error', async (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(
          `❌ Le port ${PORT} est déjà utilisé (sans doute un autre "npm run dev" encore ouvert).\n` +
            `   → Ferme-le avec Ctrl+C dans son Terminal, ou libère le port : kill $(lsof -ti :${PORT})\n` +
            `   → Ou change PORT dans .env (et lance k6 avec BASE_URL=http://localhost:<port>).`
        );
      } else {
        console.error('❌ Erreur du serveur :', err.message);
      }
      await disconnectDB();
      process.exit(1);
    });

    const arret = async () => {
      server.close();
      await disconnectDB();
      process.exit(0);
    };
    process.on('SIGINT', arret);
    process.on('SIGTERM', arret);
  } catch (err) {
    console.error('❌ Démarrage impossible :', err.message);
    process.exit(1);
  }
})();
