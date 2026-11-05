import { z } from "zod";
import { api } from "@/lib/auth";
import { db } from "@/lib/db";
import { LEAD_STATUSES } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

export const GET = api<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  return db.lead.findUnique({
    where: { id },
    include: { list: true, campaigns: { include: { campaign: true } }, threads: { orderBy: { lastMessageAt: "desc" } }, deals: true },
  });
});

export const PATCH = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const data = z
    .object({
      firstName: z.string().nullish(), lastName: z.string().nullish(), companyName: z.string().nullish(), title: z.string().nullish(),
      website: z.string().nullish(), phone: z.string().nullish(), city: z.string().nullish(), country: z.string().nullish(),
      status: z.enum(LEAD_STATUSES).optional(), customFields: z.record(z.string(), z.unknown()).optional(),
    })
    .parse(await req.json());
  return db.lead.update({ where: { id }, data: data as never });
});
