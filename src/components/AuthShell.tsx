import { Logo } from "./Logo";

export function AuthShell({ title, subtitle, children, name, logoUrl }: { title: string; subtitle?: string; children: React.ReactNode; name?: string; logoUrl?: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-brand/5 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo name={name} logoUrl={logoUrl} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold">{title}</h1>
          {subtitle && <p className="mb-5 mt-1 text-sm text-slate-500">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
