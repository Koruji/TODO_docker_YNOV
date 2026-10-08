#!/usr/bin/env bash
# Lance la base PostgreSQL puis le backend Spring Boot.
# Usage : ./run-backend.sh
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
    echo "Fichier .env introuvable : copie .env.example en .env et renseigne les valeurs." >&2
    exit 1
fi

set -a
. ./.env
set +a

# Génère un JWT_SECRET une seule fois et le garde dans .env (ignoré par git)
if [ -z "${JWT_SECRET:-}" ]; then
    JWT_SECRET="$(openssl rand -base64 48)"
    printf '\nJWT_SECRET=%s\n' "$JWT_SECRET" >> .env
    echo "JWT_SECRET généré et ajouté à .env"
fi

# Le backend lit DB_*, le compose lit POSTGRES_*
export DB_NAME="$POSTGRES_DB" DB_USER="$POSTGRES_USER" DB_PASSWORD="$POSTGRES_PASSWORD" JWT_SECRET

docker compose up -d --wait db

cd backend
exec ./mvnw spring-boot:run
