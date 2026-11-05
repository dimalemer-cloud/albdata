import { z } from "zod";
import { api, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const GET = api<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const c = await db.campaign.findUnique({
    where: { id },
    include: {
      client: true,
      steps: { orderBy: { order: "asc" }, include: { variants: { orderBy: { label: "asc" } } } },
      accounts: true,
      _count: { select: { leads: true } },
    },
  });
  if (!c) throw new HttpError(404, "Campaign not found");
  return { ...c, accountIds: c.accounts.map((a) => a.accountId) };
});

const patch = z.object({
  name: z.string().min(1).optional(),
  clientId: z.string().nullish(),
  timezone: z.string().optional(),
  days: z.array(z.number().int().min(0).max(6)).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  dailyLimit: z.coerce.number().int().min(1).max(100000).optional(),
  stopOnReply: z.boolean().optional(),
  stopOnAutoReply: z.boolean().optional(),
  stopForCompany: z.boolean().optional(),
  openTracking: z.boolean().optional(),
  linkTracking: z.boolean().optional(),
  textOnly: z.boolean().optional(),
  unsubscribeLink: z.boolean().optional(),
  prioritizeNewLeads: z.boolean().optional(),
  accountIds: z.array(z.string()).optional(),
});

export const PATCH = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { accountIds, ...data } = patch.parse(await req.json());
  if (accountIds) {
    await db.$transaction([
      db.campaignAccount.deleteMany({ where: { campaignId: id } }),
      db.campaignAccount.createMany({ data: accountIds.map((accountId) => ({ campaignId: id, accountId })) }),
    ]);
  }
  return db.campaign.update({ where: { id }, data });
});

export const DELETE = api<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await db.campaign.delete({ where: { id } });
  return { ok: true };
});
