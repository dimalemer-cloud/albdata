#!/usr/bin/env bash
# Runs every time the Codespace starts: local test mail server, background worker, web app.
cd "$(dirname "$0")/.."
PORT=${PORT:-3000}
mkdir -p .logs
if ! curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
  # Demo inboxes talk to this local mail server, so nothing ever leaves the Codespace
  MAILBOXES="alex@albgrowth-mail.test:3145,sara@albgrowth-mail.test:3146,erion@getalbdata.test:3147,mira@getalbdata.test:3148" \
    OUTBOX=.logs/outbox.jsonl setsid nohup node test/mailserver.mjs > .logs/mail.log 2>&1 < /dev/null &
  setsid nohup npx tsx --env-file-if-exists=.env src/worker/index.ts > .logs/worker.log 2>&1 < /dev/null &
  setsid nohup npx next start -p "${PORT}" > .logs/app.log 2>&1 < /dev/null &
  for i in $(seq 1 60); do curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 && break; sleep 1; done
fi
echo "albdata is running on port ${PORT} — open the Ports tab or the preview."
