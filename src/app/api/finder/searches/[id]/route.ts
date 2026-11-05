import { api, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const GET = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const s = await db.finderSearch.findUnique({ where: { id } });
  if (!s) throw new HttpError(404, "Search not found");
  const results = await db.finderResult.findMany({
    where: {
      searchId: id,
      ...(sp.get("hasEmail") === "1" ? { NOT: { emails: { isEmpty: true } } } : {}),
      ...(sp.get("hasWebsite") === "1" ? { website: { not: null } } : {}),
    },
    orderBy: [{ reviews: { sort: "desc", nulls: "last" } }, { name: "asc" }],
  });
  const crawling = await db.finderResult.count({ where: { searchId: id, crawlStatus: { in: ["RUNNING"] } } });
  const pending = await db.finderResult.count({ where: { searchId: id, crawlStatus: "PENDING" } });
  const jobs = await db.job.findMany({ where: { status: { in: ["QUEUED", "RUNNING"] }, type: { in: ["FINDER_SEARCH", "FINDER_CRAWL"] } }, select: { id: true, type: true, progress: true, total: true, payload: true } });
  return { search: s, results, crawling, pending, jobs: jobs.length };
});

export const DELETE = api<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await db.finderSearch.delete({ where: { id } });
  return { ok: true };
});
