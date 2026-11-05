import { Sidebar } from "@/components/Sidebar";
import { requireTeam } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireTeam();
  const [w, unread] = await Promise.all([getWorkspace(), db.thread.count({ where: { unread: true, hasReply: true, archived: false } })]);
  return (
    <div className="min-h-screen">
      <Sidebar name={w.name} logoUrl={w.logoUrl} user={{ name: s.name, role: s.role }} unread={unread} />
      <main className="lg:pl-60">
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
