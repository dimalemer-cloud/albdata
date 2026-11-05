"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { api } from "@/lib/client";

export function SignOut() {
  const router = useRouter();
  return (
    <button className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100" onClick={async () => { await api("/api/auth/logout", { method: "POST" }); router.push("/login"); }}>
      <LogOut className="h-4 w-4" /> Sign out
    </button>
  );
}
