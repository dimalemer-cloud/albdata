import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { api } from "@/lib/auth";
import { db } from "@/lib/db";
import { addLeadsToCampaign, importLeads } from "@/lib/leads";

type Ctx = { params: Promise<{ id: string }> };

export const GET = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const status = sp.get("status");
  const q = sp.get("q")?.trim();
  const page = Math.max(1, Number(sp.get("page") || 1));
  const size = 50;
  const where: Prisma.CampaignLeadWhereInput = {
    campaignId: id,
    ...(status ? { status: status as Prisma.EnumCampaignLeadStatusFilter["equals"] } : {}),
    ...(q ? { lead: { OR: [{ email: { contains: q, mode: "insensitive" } }, { companyName: { contains: q, mode: "insensitive" } }, { firstName: { contains: q, mode: "insensitive" } }] } } : {}),
  };
  const [total, rows] = await Promise.all([
    db.campaignLead.count({ where }),
    db.campaignLead.findMany({ where, include: { lead: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * size, take: size }),
  ]);
  const accounts = await db.emailAccount.findMany({ where: { id: { in: rows.map((r) => r.accountId).filter(Boolean) as string[] } }, select: { id: true, email: true } });
  return { total, page, size, rows: rows.map((r) => ({ ...r, accountEmail: accounts.find((a) => a.id === r.accountId)?.email ?? null })) };
});

export const POST = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const body = z
    .object({
      action: z.enum(["add_list", "add_csv", "remove", "pause", "resume"]),
      listId: z.string().optional(),
      ids: z.array(z.string()).optional(),
      leads: z.array(z.unknown()).optional(),
    })
    .parse(await req.json());
  if (body.action === "add_list") {
    const ids = (await db.lead.findMany({ where: { listId: body.listId }, select: { id: true } })).map((l) => l.id);
    return addLeadsToCampaign(id, ids);
  }
  if (body.action === "add_csv") {
    const c = await db.campaign.findUniqueOrThrow({ where: { id } });
    const list = await db.leadList.create({ data: { name: `${c.name} — import ${new Date().toLocaleDateString()}`, clientId: c.clientId } });
    const r = await importLeads(list.id, body.leads || []);
    const ids = (await db.lead.findMany({ where: { listId: list.id }, select: { id: true } })).map((l) => l.id);
    const added = await addLeadsToCampaign(id, ids);
    return { ...r, ...added };
  }
  const ids = body.ids || [];
  if (body.action === "remove") return { count: (await db.campaignLead.deleteMany({ where: { campaignId: id, id: { in: ids } } })).count };
  if (body.action === "pause") return { count: (await db.campaignLead.updateMany({ where: { campaignId: id, id: { in: ids }, status: "ACTIVE" }, data: { status: "PAUSED" } })).count };
  return { count: (await db.campaignLead.updateMany({ where: { campaignId: id, id: { in: ids }, status: "PAUSED" }, data: { status: "ACTIVE", nextSendAt: new Date() } })).count };
});
