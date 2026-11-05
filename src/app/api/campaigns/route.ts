import { z } from "zod";
import { api } from "@/lib/auth";
import { db } from "@/lib/db";
import { campaignRows } from "@/lib/analytics";
import { getWorkspace } from "@/lib/workspace";

export const GET = api(async () => campaignRows());

export const POST = api(async (req) => {
  const { name, clientId } = z.object({ name: z.string().min(1), clientId: z.string().nullish() }).parse(await req.json());
  const w = await getWorkspace();
  const activeAccounts = await db.emailAccount.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  return db.campaign.create({
    data: {
      name,
      clientId: clientId || null,
      timezone: w.defaultTimezone,
      steps: {
        create: [
          { order: 0, delayDays: 0, variants: { create: [{ label: "A", subject: "", body: "" }] } },
        ],
      },
      accounts: { create: activeAccounts.map((a) => ({ accountId: a.id })) },
    },
  });
});
