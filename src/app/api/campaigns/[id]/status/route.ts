import { z } from "zod";
import { api, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";

export const POST = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const { action } = z.object({ action: z.enum(["launch", "pause", "resume"]) }).parse(await req.json());
  const c = await db.campaign.findUnique({ where: { id }, include: { steps: { include: { variants: true } }, accounts: true, _count: { select: { leads: true } } } });
  if (!c) throw new HttpError(404, "Campaign not found");
  if (action === "pause") return db.campaign.update({ where: { id }, data: { status: "PAUSED" } });
  const problems: string[] = [];
  if (!c.accounts.length) problems.push("select at least one sending account (Options tab)");
  if (!c._count.leads) problems.push("add leads");
  c.steps.forEach((s, i) => {
    if (!s.variants.some((v) => v.enabled && v.body.trim())) problems.push(`step ${i + 1} has no email body`);
  });
  if (!c.steps[0]?.variants.some((v) => v.enabled && v.subject.trim())) problems.push("step 1 needs a subject line");
  if (problems.length) throw new HttpError(400, `Can't launch yet: ${problems.join("; ")}.`);
  return db.campaign.update({ where: { id }, data: { status: "ACTIVE", launchedAt: c.launchedAt ?? new Date() } });
});
