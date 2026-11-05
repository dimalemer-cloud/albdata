import { redirect } from "next/navigation";
import { requireAnyUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { ReportShell } from "@/components/report/ReportShell";
import { ReportView } from "@/components/report/ReportView";
import { SignOut } from "@/components/report/SignOut";

export default async function Portal() {
  const s = await requireAnyUser();
  if (s.role !== "CLIENT") redirect("/clients");
  const user = await db.user.findUnique({ where: { id: s.sub }, include: { client: true } });
  if (!user?.client) redirect("/login");
  const w = await getWorkspace();
  return (
    <ReportShell agency={w.name} logoUrl={w.logoUrl} clientName={user.client.name} right={<div className="flex items-center gap-2 text-sm text-slate-600">{user.name}<SignOut /></div>}>
      <ReportView clientId={user.client.id} />
    </ReportShell>
  );
}
