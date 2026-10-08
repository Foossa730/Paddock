#!/bin/bash
# Double-clique sur ce fichier pour lancer un test k6 (l'API doit être démarrée).
cd "$(dirname "$0")" || exit 1
clear
echo "📊 Tests de performance k6"
echo "=========================="

if ! command -v npm >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
fi

# Le Mac bloque parfois les programmes téléchargés : on débloque k6
xattr -d com.apple.quarantine bin/k6 2>/dev/null
chmod +x bin/k6 2>/dev/null
if ! ./bin/k6 version >/dev/null 2>&1; then
  echo "❌ k6 ne démarre pas sur ce Mac."
  read -n 1 -s -r -p "Appuie sur une touche pour fermer…"; exit 1
fi
./bin/k6 version

# L'API doit tourner
if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health | grep -q 200; then
  echo ""
  echo "❌ L'API ne répond pas sur http://localhost:3000"
  echo "   Double-clique d'abord sur « 1-Lancer-API.command », attends le message"
  echo "   « API voitures en écoute », puis relance ce fichier."
  read -n 1 -s -r -p "Appuie sur une touche pour fermer…"; exit 1
fi

echo ""
echo "Quel test lancer ?"
echo "  1) Rapide  – vérifie toutes les routes (≈ 30 s)"
echo "  2) Charge  – 10 utilisateurs + écritures (≈ 2 min)"
echo "  3) Stress  – jusqu'à 50 utilisateurs (≈ 2 min)"
read -r -p "Ton choix [1] : " CHOIX
case "$CHOIX" in
  2) TEST=charge ;;
  3) TEST=stress ;;
  *) TEST=smoke ;;
esac

mkdir -p rapports
RAPPORT="rapports/rapport-$TEST-$(date +%Y%m%d-%H%M%S).html"
echo ""
echo "▶️  Test « $TEST » en cours… le tableau de bord s'ouvre dans ton navigateur."
echo "   ⚠️  Quand le test est fini, FERME l'onglet du tableau de bord dans ton navigateur :"
echo "      k6 attend qu'il soit fermé pour terminer, puis le rapport s'ouvre automatiquement."
K6_NO_USAGE_REPORT=true K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_OPEN=true K6_WEB_DASHBOARD_PERIOD=2s \
  K6_WEB_DASHBOARD_EXPORT="$RAPPORT" ./bin/k6 run "k6/$TEST.js"
RESULTAT=$?

echo ""
if [ $RESULTAT -eq 0 ]; then echo "✅ Test réussi : tous les seuils sont respectés."
else echo "⚠️  Certains seuils ne sont pas respectés (voir le résumé ci-dessus)."; fi
if [ -f "$RAPPORT" ]; then
  echo "📄 Rapport enregistré : $RAPPORT"
  open "$RAPPORT"
fi
read -n 1 -s -r -p "Appuie sur une touche pour fermer…"
