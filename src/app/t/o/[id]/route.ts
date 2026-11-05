import { db } from "@/lib/db";

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id.replace(/\.gif$/, "");
  try {
    const m = await db.message.findUnique({ where: { id } });
    // ignore prefetches within 3s of sending (security scanners)
    if (m && m.direction === "OUTBOUND" && Date.now() - m.sentAt.getTime() > 3000) {
      await db.message.update({ where: { id }, data: { openCount: { increment: 1 }, openedAt: m.openedAt ?? new Date() } });
      if (!m.openedAt) {
        await db.event.create({ data: { type: "OPEN", campaignId: m.campaignId, campaignLeadId: m.campaignLeadId, messageId: m.id, accountId: m.accountId, stepIndex: m.stepIndex, variantId: m.variantId } });
      }
    }
  } catch {}
  return new Response(GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache, must-revalidate, private", Pragma: "no-cache" } });
}
