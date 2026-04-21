#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Script d'extraction et vérification pour EPJ App Globale v10
#  Utilisez ce script en Terminal pour éviter la traduction Safari
# ═══════════════════════════════════════════════════════════════

set -e
cd "$(dirname "$0")"

echo ""
echo "📦 Vérification de la structure EPJ App Globale v10..."
echo ""

# Vérifie que src/ existe et pas source/
if [ -d "src" ] && [ ! -d "source" ]; then
  echo "✅ Dossier 'src/' trouvé (correct)"
else
  if [ -d "source" ]; then
    echo "⚠ Dossier 'source' détecté — RENOMMAGE en 'src'..."
    mv source src
    echo "✅ Renommé en 'src/'"
  else
    echo "❌ ERREUR : ni 'src/' ni 'source/' trouvé"
    exit 1
  fi
fi

# Vérifie src/core et pas src/cœur
if [ -d "src/core" ] && [ ! -d "src/cœur" ]; then
  echo "✅ Dossier 'src/core/' trouvé (correct)"
else
  if [ -d "src/cœur" ]; then
    echo "⚠ Dossier 'src/cœur' détecté — RENOMMAGE en 'src/core'..."
    mv "src/cœur" "src/core"
    echo "✅ Renommé en 'src/core/'"
  else
    echo "❌ ERREUR : ni 'src/core/' ni 'src/cœur/' trouvé"
    exit 1
  fi
fi

echo ""
echo "🎉 Structure OK — tu peux uploader 'src/' sur GitHub."
echo ""
echo "Commandes git pour déployer :"
echo "  git add src/"
echo "  git commit -m 'v10 - Parc machines packs + safe-area iPhone'"
echo "  git push origin main"
echo ""
