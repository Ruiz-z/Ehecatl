#!/bin/sh
set -eu

: "${DATABASE_URL:?Define DATABASE_URL para aplicar las migraciones}"
: "${JWT_SECRET:?Define JWT_SECRET en el .env no versionado}"
: "${SEED_DEMO_PASSWORD:?Define SEED_DEMO_PASSWORD en el .env no versionado}"
: "${GEO_URL:?Define GEO_URL para precargar NASA real}"

node node_modules/prisma/build/index.js migrate deploy
node dist-seed/prisma/seed.js
exec "$@"
