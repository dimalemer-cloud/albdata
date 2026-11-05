#!/usr/bin/env bash
# Runs once when the Codespace is created: install, migrate, build, load demo data.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  if [ -n "${CODESPACE_NAME:-}" ]; then
    APP_URL="https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
  else
    APP_URL="http://localhost:${PORT:-3000}"
  fi
  cat > .env <<ENV
DATABASE_URL=${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/albdata}
APP_URL=${APP_URL}
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")
VERIFY_HELO=localhost
DEMO_LOGIN=demo@albdata.test:albdata-demo
ENV
fi

npm ci
echo "Waiting for the database…"
for i in $(seq 1 30); do npx prisma migrate deploy && break; sleep 2; done
npx next build
node --env-file=.env test/seed-demo.mjs
echo "Setup complete."
