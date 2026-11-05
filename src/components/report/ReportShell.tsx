import { Logo } from "@/components/Logo";

export function ReportShell({ agency, logoUrl, clientName, children, right }: { agency: string; logoUrl: string | null; clientName: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo name={agency} logoUrl={logoUrl} />
          {right}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-5">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Outreach report</div>
          <h1 className="text-xl font-semibold">{clientName}</h1>
        </div>
        {children}
      </main>
    </div>
  );
}
