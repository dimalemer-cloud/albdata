"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md";
  loading?: boolean;
};
export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: BtnProps) {
  const v = {
    primary: "bg-brand text-white hover:bg-brand/90 shadow-sm",
    secondary: "bg-slate-900 text-white hover:bg-slate-800",
    outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
  }[variant];
  const s = size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm";
  return (
    <button
      className={cn("inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap", v, s, className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

const hasWidth = (c?: string) => !!c && /(^|\s)(w-|!w-)/.test(c);

export function Input({ className, ...rest }: React.ComponentProps<"input">) {
  return <input className={cn("h-9 rounded-lg", !hasWidth(className) && "w-full", " border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20", className)} {...rest} />;
}
export function Textarea({ className, ...rest }: React.ComponentProps<"textarea">) {
  return <textarea className={cn("w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20", className)} {...rest} />;
}
export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn("h-9 rounded-lg", !hasWidth(className) && "w-full", " border border-slate-300 bg-white px-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20", className)} {...rest}>
      {children}
    </select>
  );
}
export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-medium text-slate-600">
      {children}
      {hint && <span className="ml-1 font-normal text-slate-400">{hint}</span>}
    </label>
  );
}
export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label hint={hint}>{label}</Label>
      {children}
    </div>
  );
}

export function Card({ className, children, title, actions }: { className?: string; children: ReactNode; title?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="text-sm font-semibold text-slate-800">{title}</div>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
      )}
      {children}
    </div>
  );
}

const BADGE: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  yellow: "bg-amber-50 text-amber-700 ring-amber-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  purple: "bg-violet-50 text-violet-700 ring-violet-200",
  gray: "bg-slate-100 text-slate-600 ring-slate-200",
  brand: "bg-brand/10 text-brand ring-brand/20",
};
export function Badge({ color = "gray", children, className }: { color?: string; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", BADGE[color] || BADGE.gray, className)}>{children}</span>;
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition", checked ? "bg-brand" : "bg-slate-300")}
      >
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition", checked ? "left-[18px]" : "left-0.5")} />
      </button>
      {(label || hint) && (
        <span>
          <span className="block text-sm text-slate-800">{label}</span>
          {hint && <span className="block text-xs text-slate-500">{hint}</span>}
        </span>
      )}
    </label>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[8vh]" onMouseDown={onClose}>
      <div className={cn("w-full rounded-xl bg-white shadow-xl", wide ? "max-w-3xl" : "max-w-lg")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, color }: { label: string; value: ReactNode; sub?: ReactNode; color?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 rounded-full bg-brand/10 p-3 text-brand">{icon}</div>}
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      {text && <p className="mt-1 max-w-md text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: ReactNode }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition", value === t.id ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-800")}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Toast = { id: number; text: string; kind: "ok" | "error" };
const ToastCtx = createContext<(text: string, kind?: "ok" | "error") => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={cn("flex max-w-sm items-start gap-2 rounded-lg px-3.5 py-2.5 text-sm shadow-lg", t.kind === "ok" ? "bg-slate-900 text-white" : "bg-red-600 text-white")}>
            {t.kind === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function Progress({ value, max, color }: { value: number; max: number; color?: string }) {
  const p = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${p}%`, ...(color ? { background: color } : {}) }} />
    </div>
  );
}

export const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "green", PAUSED: "yellow", DRAFT: "gray", COMPLETED: "blue", ERROR: "red",
  NEW: "gray", CONTACTED: "blue", REPLIED: "purple", INTERESTED: "green", NOT_INTERESTED: "red", MEETING_BOOKED: "blue",
  WON: "green", LOST: "red", UNSUBSCRIBED: "red", BOUNCED: "red",
  valid: "green", invalid: "red", catch_all: "yellow", risky: "yellow", unknown: "gray",
  OUT_OF_OFFICE: "yellow", WRONG_PERSON: "gray", UNSUBSCRIBE: "red", NEUTRAL: "gray",
};
export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-xs text-slate-400">—</span>;
  const label = status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  return <Badge color={STATUS_COLOR[status] || "gray"}>{label}</Badge>;
}
