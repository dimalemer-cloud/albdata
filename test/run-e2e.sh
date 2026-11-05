#!/usr/bin/env bash
# Runs the full end-to-end test on a clean database with local mail servers.
# Requires: Postgres at DATABASE_URL (from .env), built app (npm run build).
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
WORK=${WORK:-$(mktemp -d)}
OUTBOX="$WORK/outbox.jsonl"
rm -f "$OUTBOX"
pkill -f "test/mailserver.mjs" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
pkill -f "src/worker/index.ts" 2>/dev/null || true
sleep 1
psql "$DATABASE_URL" -q -o /dev/null -c "DO \$\$ DECLARE r record; BEGIN FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' LOOP EXECUTE 'TRUNCATE TABLE \"' || r.tablename || '\" CASCADE'; END LOOP; END \$\$;"
MAILBOXES="sender1@agency.test:3143,sender2@agency.test:3144" OUTBOX="$OUTBOX" SPAM_EVERY=3 node test/mailserver.mjs > "$WORK/mail.log" 2>&1 &
npx next start -p 3000 > "$WORK/app.log" 2>&1 &
SENDER_INTERVAL_MS=3000 SYNC_INTERVAL_MS=4000 WARMUP_INTERVAL_MS=5000 npx tsx --env-file-if-exists=.env src/worker/index.ts > "$WORK/worker.log" 2>&1 &
for i in $(seq 1 30); do curl -sf http://127.0.0.1:3000/api/health >/dev/null && break; sleep 1; done
BASE=http://127.0.0.1:3000 OUTBOX="$OUTBOX" node test/e2e.mjs
