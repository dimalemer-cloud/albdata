import { Suspense } from "react";
import { CampaignDetail } from "@/components/campaigns/CampaignDetail";
import { db } from "@/lib/db";
import { aiEnabled } from "@/lib/ai";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [accounts, lists, clients, ai] = await Promise.all([
    db.emailAccount.findMany({ select: { id: true, email: true, fromName: true, status: true, tags: true, dailyLimit: true }, orderBy: { email: "asc" } }),
    db.leadList.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { leads: true } } } }),
    db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    aiEnabled(),
  ]);
  return (
    <Suspense>
      <CampaignDetail id={id} ctx={{ accounts, lists: lists.map((l) => ({ id: l.id, name: l.name, count: l._count.leads })), clients, aiEnabled: ai }} />
    </Suspense>
  );
}
