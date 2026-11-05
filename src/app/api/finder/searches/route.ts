import { z } from "zod";
import { api } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/engine/jobs";

export const GET = api(async () => {
  const searches = await db.finderSearch.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  const withEmail = await db.finderResult.groupBy({ by: ["searchId"], where: { searchId: { in: searches.map((s) => s.id) }, NOT: { emails: { isEmpty: true } } }, _count: { _all: true } });
  return searches.map((s) => ({ ...s, withEmail: withEmail.find((w) => w.searchId === s.id)?._count._all ?? 0 }));
});

export const POST = api(async (req) => {
  const b = z.object({ query: z.string().min(2), location: z.string().min(2), source: z.enum(["osm", "google"]).default("osm"), autoCrawl: z.boolean().default(true) }).parse(await req.json());
  const s = await db.finderSearch.create({ data: { query: b.query, location: b.location, source: b.source } });
  const job = await enqueue("FINDER_SEARCH", { searchId: s.id, autoCrawl: b.autoCrawl });
  return { ...s, jobId: job.id };
});
