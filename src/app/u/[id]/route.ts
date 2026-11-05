import { db } from "@/lib/db";
import { escapeHtml } from "@/lib/utils";

async function unsubscribe(id: string) {
  const m = await db.message.findUnique({ where: { id }, include: { lead: true } });
  if (!m) return null;
  const email = m.toEmail.toLowerCase();
  await db.blockedEntry.upsert({ where: { value: email }, update: {}, create: { value: email, reason: "Unsubscribed via link" } });
  if (m.leadId) await db.lead.updateMany({ where: { email }, data: { status: "UNSUBSCRIBED" } });
  await db.campaignLead.updateMany({ where: { lead: { email }, status: "ACTIVE" }, data: { status: "UNSUBSCRIBED", nextSendAt: null } });
  if (m.campaignLeadId) {
    const already = await db.event.count({ where: { type: "UNSUBSCRIBE", campaignLeadId: m.campaignLeadId } });
    if (!already) await db.event.create({ data: { type: "UNSUBSCRIBE", campaignId: m.campaignId, campaignLeadId: m.campaignLeadId, messageId: m.id, accountId: m.accountId } });
  }
  return email;
}

function page(body: string) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title>
<style>body{font-family:system-ui,sans-serif;background:#f7f8fa;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:28px;max-width:420px;text-align:center}
button{background:#0f172a;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-size:14px;cursor:pointer}p{color:#475569}</style></head>
<body><div class="card">${body}</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await db.message.findUnique({ where: { id } });
  if (!m) return page("<h2>Link expired</h2><p>This unsubscribe link is no longer valid.</p>");
  return page(`<h2>Unsubscribe</h2><p>Stop receiving emails at <b>${escapeHtml(m.toEmail)}</b>?</p><form method="post"><button>Unsubscribe</button></form>`);
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const email = await unsubscribe(id);
  if (!email) return page("<h2>Link expired</h2>");
  return page(`<h2>You're unsubscribed</h2><p>${escapeHtml(email)} won't receive further emails from us.</p>`);
}
