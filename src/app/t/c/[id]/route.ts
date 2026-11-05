import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const home = NextResponse.redirect(new URL("/", req.url), 302);
  let target = "";
  try {
    target = Buffer.from(new URL(req.url).searchParams.get("u") || "", "base64url").toString("utf8");
  } catch {
    return home;
  }
  if (!/^https?:\/\//i.test(target)) return home;

  const m = await db.message.findUnique({ where: { id } }).catch(() => null);
  // Only redirect to links that are actually in this email (prevents open-redirect abuse)
  if (!m || m.direction !== "OUTBOUND" || (!m.bodyHtml.includes(target) && !m.bodyHtml.includes(target.replace(/&/g, "&amp;")))) return home;

  try {
    await db.message.update({ where: { id }, data: { clickCount: { increment: 1 }, clickedAt: m.clickedAt ?? new Date(), openedAt: m.openedAt ?? new Date() } });
    const base = { campaignId: m.campaignId, campaignLeadId: m.campaignLeadId, messageId: m.id, accountId: m.accountId, stepIndex: m.stepIndex, variantId: m.variantId };
    if (!m.clickedAt) await db.event.create({ data: { type: "CLICK", url: target, ...base } });
    if (!m.openedAt) await db.event.create({ data: { type: "OPEN", ...base } });
  } catch (e) {
    console.error("[click]", (e as Error).message);
  }
  return NextResponse.redirect(target, 302);
}
