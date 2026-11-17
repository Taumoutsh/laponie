#!/bin/sh
# Laponie — sauvegardes PostgreSQL avec rotation.
#   backup.sh loop   sauvegarde au démarrage puis toutes les BACKUP_INTERVAL_HOURS heures (défaut)
#   backup.sh once   une sauvegarde immédiate
#   backup.sh list   liste les sauvegardes
# Variables : PGHOST, PGUSER, PGPASSWORD, PGDATABASE, BACKUP_DIR (/backups),
#             BACKUP_KEEP (14), BACKUP_INTERVAL_HOURS (24)
set -eu

DIR="${BACKUP_DIR:-/backups}"
KEEP="${BACKUP_KEEP:-14}"
INTERVAL="${BACKUP_INTERVAL_HOURS:-24}"
DB="${PGDATABASE:-laponie}"
PREFIX="${BACKUP_PREFIX:-laponie}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

prune() {
  # Garde les KEEP sauvegardes les plus récentes, supprime les autres.
  count=0
  for f in $(ls -1t "$DIR"/laponie_*.dump 2>/dev/null); do
    count=$((count + 1))
    if [ "$count" -gt "$KEEP" ]; then
      rm -f -- "$f"
      log "  ancienne sauvegarde supprimée : $(basename "$f")"
    fi
  done
}

backup_once() {
  mkdir -p "$DIR"
  rm -f "$DIR"/*.tmp
  file="$DIR/${PREFIX}_$(date +%Y-%m-%d_%H%M%S).dump"
  pg_dump --format=custom --no-owner --file="$file.tmp" "$DB"
  mv "$file.tmp" "$file"
  log "Sauvegarde créée : $(basename "$file") ($(du -h "$file" | cut -f1))"
  prune
}

case "${1:-loop}" in
  once)
    backup_once
    ;;
  list)
    ls -1t "$DIR"/*.dump 2>/dev/null | while read -r f; do echo "$(du -h "$f" | cut -f1)	$(basename "$f")"; done
    [ -n "$(ls "$DIR"/*.dump 2>/dev/null)" ] || echo "Aucune sauvegarde."
    ;;
  loop)
    log "Sauvegardes toutes les ${INTERVAL} h, ${KEEP} conservées, dans ${DIR}"
    until pg_isready -q; do sleep 2; done
    while true; do
      backup_once || log "ÉCHEC de la sauvegarde"
      sleep $((INTERVAL * 3600))
    done
    ;;
  *)
    echo "Usage : backup.sh [loop|once|list]"
    exit 1
    ;;
esac
