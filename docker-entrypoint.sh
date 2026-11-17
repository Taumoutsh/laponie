#!/bin/sh
set -e

echo "Laponie : application des migrations de la base…"
./node_modules/.bin/prisma migrate deploy

echo "Laponie : démarrage sur le port ${PORT:-3000}"
exec ./node_modules/.bin/next start -H "${HOSTNAME:-0.0.0.0}" -p "${PORT:-3000}"
