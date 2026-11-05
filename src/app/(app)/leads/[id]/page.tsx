import { Suspense } from "react";
import { ListDetail } from "@/components/leads/ListDetail";
import { db } from "@/lib/db";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaigns = await db.campaign.findMany({ where: { status: { not: "COMPLETED" } }, select: { id: true, name: true, status: true }, orderBy: { createdAt: "desc" } });
  return (
    <Suspense>
      <ListDetail listId={id} campaigns={campaigns} />
    </Suspense>
  );
}
