import "./globals.css";
import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const w = await getWorkspace().catch(() => null);
  return { title: w?.name || "albdata", description: "Cold email outreach, warmup, lead finder and CRM" };
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const w = await getWorkspace().catch(() => null);
  const brand = hexToRgb(w?.brandColor || "#2563eb");
  return (
    <html lang="en">
      <head>
        <style>{`:root{--brand:${brand};}`}</style>
        {w?.logoUrl && <link rel="icon" href={w.logoUrl} />}
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
