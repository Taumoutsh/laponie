#!/bin/sh
# Laponie — restaure une sauvegarde (remplace TOUTES les données actuelles).
#   restore.sh latest
#   restore.sh laponie_2026-11-17_030000.dump
# Une sauvegarde de sécurité « avant-restauration_… » est faite juste avant.
set -eu

DIR="${BACKUP_DIR:-/backups}"
DB="${PGDATABASE:-laponie}"
file="${1:-}"

if [ -z "$file" ]; then
  echo "Usage : restore.sh <fichier.dump | latest>"
  echo "Sauvegardes disponibles :"
  ls -1t "$DIR"/*.dump 2>/dev/null || echo "  (aucune)"
  exit 1
fi
if [ "$file" = "latest" ]; then
  file=$(ls -1t "$DIR"/laponie_*.dump 2>/dev/null | head -n 1)
  [ -n "$file" ] || { echo "Aucune sauvegarde trouvée."; exit 1; }
fi
case "$file" in
  /*) ;;
  *) file="$DIR/$file" ;;
esac
[ -f "$file" ] || { echo "Fichier introuvable : $file"; exit 1; }

echo "Sauvegarde de sécurité de l'état actuel…"
BACKUP_PREFIX=avant-restauration sh "$(dirname "$0")/backup.sh" once

echo "Restauration de $(basename "$file") dans la base « $DB »…"
pg_restore --clean --if-exists --no-owner --single-transaction --dbname="$DB" "$file"
echo "Restauration terminée."
