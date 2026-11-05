import { cn } from "@/lib/utils";

export function Logo({ name = "albdata", logoUrl, className, light }: { name?: string; logoUrl?: string | null; className?: string; light?: boolean }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={name} className={cn("h-8 w-auto max-w-[160px] object-contain", className)} />;
  }
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 18 L12 5 L20 18" />
          <path d="M8 13 H16" />
        </svg>
      </div>
      <span className={cn("text-lg font-bold tracking-tight", light ? "text-white" : "text-slate-900")}>{name}</span>
    </div>
  );
}
