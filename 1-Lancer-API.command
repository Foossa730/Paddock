#!/bin/bash
# Double-clique sur ce fichier pour démarrer l'API voitures.
cd "$(dirname "$0")" || exit 1
clear
echo "🏎️  Démarrage de l'API voitures"
echo "================================"

# Node.js installé via nvm : on le charge si besoin
if ! command -v npm >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "❌ Node.js est introuvable. Installe-le depuis https://nodejs.org puis réessaie."
  read -n 1 -s -r -p "Appuie sur une touche pour fermer…"; exit 1
fi

# Dépendances
if [ ! -d node_modules ]; then
  echo "📦 Installation des dépendances (une seule fois)…"
  npm install || { read -n 1 -s -r -p "Échec. Appuie sur une touche pour fermer…"; exit 1; }
fi

# Libère le port 3000 si une ancienne API tourne encore
PIDS=$(lsof -ti tcp:3000 -sTCP:LISTEN 2>/dev/null)
if [ -n "$PIDS" ]; then
  for PID in $PIDS; do
    NOM=$(ps -p "$PID" -o comm= 2>/dev/null)
    if [[ "$NOM" == *node* ]]; then
      echo "🔁 Une ancienne API occupait le port 3000 (processus $PID) : arrêt."
      kill "$PID" 2>/dev/null
    else
      echo "❌ Le port 3000 est utilisé par une autre application : $NOM (processus $PID)."
      echo "   Ferme cette application puis relance ce fichier."
      read -n 1 -s -r -p "Appuie sur une touche pour fermer…"; exit 1
    fi
  done
  sleep 1
fi

echo ""
echo "👉 Laisse cette fenêtre ouverte tant que tu utilises l'API."
echo "   Pour l'arrêter : ferme la fenêtre (ou Ctrl+C)."
echo "   Interface : http://localhost:3000   ·   API : http://localhost:3000/api/voitures"
echo ""
( sleep 4 && curl -s -o /dev/null http://localhost:3000/health && open "http://localhost:3000/" ) &
npm run dev
