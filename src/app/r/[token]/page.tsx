import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { ReportShell } from "@/components/report/ReportShell";
import { ReportView } from "@/components/report/ReportView";

export const metadata = { robots: { index: false, follow: false } };

export default async function SharedReport({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await db.client.findUnique({ where: { shareToken: token } });
  if (!client) notFound();
  const w = await getWorkspace();
  return (
    <ReportShell agency={w.name} logoUrl={w.logoUrl} clientName={client.name}>
      <ReportView clientId={client.id} />
    </ReportShell>
  );
}
