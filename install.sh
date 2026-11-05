#!/usr/bin/env bash
# albdata one-command installer for a fresh Ubuntu/Debian VPS.
# Usage: sudo bash install.sh
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker…"
  curl -fsSL https://get.docker.com | sh
fi

if [ ! -f .env ]; then
  read -rp "App domain (e.g. app.youragency.com, pointed at this server's IP): " DOMAIN
  read -rp "Your Claude API key (optional, press Enter to skip): " ANTHROPIC_API_KEY
  rand() { openssl rand -hex 24; }
  cat > .env <<ENV
DOMAIN=${DOMAIN}
APP_URL=https://${DOMAIN}
POSTGRES_PASSWORD=$(rand)
SESSION_SECRET=$(rand)
ENCRYPTION_KEY=$(rand)
VERIFY_HELO=${DOMAIN}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
GOOGLE_PLACES_API_KEY=
TRACKING_DOMAINS=
ENV
  chmod 600 .env
  echo "Wrote .env — keep it safe. ENCRYPTION_KEY protects stored inbox passwords."
fi

docker compose up -d --build
echo
echo "albdata is starting. Open https://$(grep ^DOMAIN= .env | cut -d= -f2) in a minute to create the owner account."
echo "Tip: ask your VPS provider to open outbound port 25 so the email verifier/finder can check mailboxes."
