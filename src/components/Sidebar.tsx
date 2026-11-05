"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, MapPinned, Users, Send, Inbox, KanbanSquare, AtSign, Building2, Settings, LogOut, Menu, X, Flame } from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";
import { api } from "@/lib/client";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/finder", label: "Lead Finder", icon: MapPinned },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/campaigns", label: "Campaigns", icon: Send },
  { href: "/unibox", label: "Unibox", icon: Inbox, badge: "unread" },
  { href: "/crm", label: "CRM", icon: KanbanSquare },
  { href: "/accounts", label: "Email Accounts", icon: AtSign },
  { href: "/warmup", label: "Warmup", icon: Flame },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ name, logoUrl, user, unread }: { name: string; logoUrl?: string | null; user: { name: string; role: string }; unread: number }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 px-3">
      {NAV.map((n) => {
        const active = path === n.href || path.startsWith(n.href + "/");
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition",
              active ? "bg-brand/10 text-brand" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="flex-1">{n.label}</span>
            {n.badge === "unread" && unread > 0 && <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold leading-4 text-white">{unread}</span>}
          </Link>
        );
      })}
    </nav>
  );
  const footer = (
    <div className="border-t border-slate-100 p-3">
      <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{user.name}</div>
          <div className="text-[11px] capitalize text-slate-500">{user.role.toLowerCase()}</div>
        </div>
        <button
          title="Sign out"
          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          onClick={async () => {
            await api("/api/auth/logout", { method: "POST" });
            router.push("/login");
            router.refresh();
          }}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="px-5 py-5">
          <Logo name={name} logoUrl={logoUrl} />
        </div>
        {nav}
        {footer}
      </aside>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <Logo name={name} logoUrl={logoUrl} />
        <button onClick={() => setOpen(true)} className="rounded p-1.5 hover:bg-slate-100" aria-label="Menu">
          <Menu className="h-5 w-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-64 flex-col bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4">
              <Logo name={name} logoUrl={logoUrl} />
              <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}
