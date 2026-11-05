# albdata

Self-hosted cold email platform for agencies: sending inboxes, warmup, multi-step campaigns, a unified reply inbox, lead finder, CRM, AI, and client reports. Your data stays on your server.

## Features

| Area | What it does |
|---|---|
| **Email accounts** | Connect Google Workspace/Gmail (App Password), Microsoft 365 or any SMTP/IMAP inbox. Live connection test, bulk import, daily limits, sending gaps, signatures, tags, SPF/DKIM/DMARC check. |
| **Warmup** | Your inboxes email each other, rescue warmup mail from spam, mark it important and reply. Volume ramps up daily. Health score = % landing in inbox. |
| **Campaigns** | Unlimited steps, A/B/C… variants per step, spintax `{Hi\|Hello}`, variables with fallbacks `{{firstName\|there}}`, any CSV column as a variable, schedule (timezone, days, hours), inbox rotation with the same inbox kept per lead, follow-ups threaded as replies, stop on reply / auto-reply / company reply, open and click tracking, one-click unsubscribe header, plain-text mode, live preview per lead, deliverability check, test sends. |
| **Unibox** | All replies from all inboxes in one place. Auto-labels Interested / Meeting booked / Not interested / Out of office / Wrong person / Unsubscribe (Claude AI, or rules without a key). Reply in-thread and draft replies with AI. Replies and bounces that land in spam are caught too. |
| **Leads** | Lists, CSV import with column mapping, dedupe, blocklist (emails and domains), bulk email verification, export. |
| **Lead Finder** | Find local businesses by type and location (OpenStreetMap is free; Google Maps needs a Places API key). The website crawler finds emails (mailto, obfuscated, Cloudflare-protected), phones and social links, and AI extracts owner and staff names. Also an email finder (name + domain → verified address) and a single-email verifier. Saves to a lead list with rating/category/address as variables. |
| **CRM** | Interested replies become deals automatically. Kanban pipeline (Interested → Meeting → Proposal → Won/Lost) with values and notes. |
| **Clients** | Assign campaigns and lists to clients. Each client gets a private report link and/or a read-only login (stats, campaigns, interested leads). |
| **AI (Claude)** | Write a whole sequence from a brief (with A/B variants), rewrite copy, classify replies, draft replies, extract contacts from websites. |
| **Team** | Owner / Admin / Member roles. Your logo and brand color on the app, login and client reports. |

## Deploy on a VPS (recommended)

You need a VPS (Ubuntu 22.04+, 2 GB RAM is enough; e.g. Hetzner CX22) and a domain.

1. Point a DNS **A record** (e.g. `app.youragency.com`) to the server's IP.
2. Copy this folder to the server and run:

   ```bash
   sudo bash install.sh
   ```

   It installs Docker, asks for your domain (and optional Claude API key), generates secrets into `.env`, and starts everything with automatic HTTPS.
3. Open `https://app.youragency.com`, create the owner account, then upload your logo in **Settings → Branding**.

To update after code changes, run `docker compose up -d --build`. To back up, run `docker compose exec db pg_dump -U albdata albdata > backup.sql`.

**Port 25:** the email verifier and finder talk to mail servers on port 25. Many providers block it by default; ask support to open outbound port 25. Sending is unaffected (it uses Gmail's SMTP on port 465).

## Connecting Gmail / Google Workspace inboxes

1. Turn on 2-Step Verification for the account.
2. Create an App Password at <https://myaccount.google.com/apppasswords>.
3. In albdata, go to **Email Accounts → Add account**, choose Google, and paste the 16-character password.

For each sending domain add:
- **SPF:** TXT `@` → `v=spf1 include:_spf.google.com ~all`
- **DKIM:** Google Admin → Apps → Gmail → Authenticate email → generate, then add the TXT record
- **DMARC:** TXT `_dmarc` → `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com`

The account settings dialog shows whether each record is present. Best practice: use secondary domains (not your main one), 2–3 inboxes per domain, 30–50 emails/day per inbox, and warm up for 2–3 weeks before campaigns.

## Integrations (Settings → Integrations)

- **Claude API key** (console.anthropic.com): enables all AI features. Model is selectable (Opus 5.5 default; Sonnet 5.5 / Haiku 5.5 are cheaper). Refusal fallback is enabled on every call.
- **Google Places API key** (optional): Google Maps data in the Lead Finder.
- **Custom tracking domain** (Settings → Deliverability): CNAME `track.yourdomain.com` → your app domain, add it to `TRACKING_DOMAINS` in `.env`, then run `docker compose up -d`.

## Local development

```bash
cp .env.example .env            # set DATABASE_URL to a local Postgres
npm install
npx prisma migrate dev
npm run dev                     # web app on http://localhost:3000
npm run worker                  # background worker (sending, sync, warmup, jobs)
```

### Tests

`test/run-e2e.sh` runs a full end-to-end test on a clean database against local SMTP + IMAP servers (`test/mailserver.mjs`). It covers connect, import, campaign send, rotation, variables/spintax, tracking, threading, replies, AI/rule labels, CRM, bounces, unsubscribe, warmup and the client portal. **It wipes the database in `.env`, so only run it against a dev database.**

```bash
npm run build && ./test/run-e2e.sh
```

## Architecture

- **Next.js 15** (App Router) web app and API, **PostgreSQL** via Prisma.
- **Worker** (`src/worker`): campaign sender (every 20s), IMAP sync for replies, bounces and warmup (every 90s), warmup engine (every 3 min), job queue for lead finder searches, crawls and verification.
- Inbox passwords and API keys are encrypted at rest (AES-256-GCM, `ENCRYPTION_KEY`).
- Docker Compose: `db`, `app`, `worker`, `caddy` (automatic HTTPS).

| Env var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection |
| `APP_URL` | Public URL (tracking + unsubscribe links) |
| `SESSION_SECRET`, `ENCRYPTION_KEY` | Random secrets. Don't change `ENCRYPTION_KEY` after adding inboxes |
| `VERIFY_HELO` | Hostname used for SMTP verification (your domain) |
| `ANTHROPIC_API_KEY`, `GOOGLE_PLACES_API_KEY` | Optional; can also be set in the UI |
| `DOMAIN`, `TRACKING_DOMAINS` | Used by Caddy for HTTPS |

## Responsible sending

Send B2B cold email only to relevant business contacts. Keep the unsubscribe link on, honor opt-outs (albdata adds them to the blocklist automatically), and follow CAN-SPAM, GDPR (legitimate interest + easy opt-out) and Gmail/Yahoo bulk-sender rules.
