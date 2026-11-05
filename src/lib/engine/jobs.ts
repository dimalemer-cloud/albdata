import pLimit from "p-limit";
import type { Job, Prisma } from "@prisma/client";
import { db } from "../db";
import { searchOsm } from "../finder/osm";
import { searchPlaces } from "../finder/places";
import { crawlWebsite } from "../finder/crawler";
import { verifyEmail } from "../verify";
import { aiEnabled, extractContactsFromPage } from "../ai";
import { getSecrets } from "../workspace";

export async function enqueue(type: string, payload: Prisma.InputJsonValue, total = 0) {
  return db.job.create({ data: { type, payload, total } });
}

async function progress(jobId: string, done: number, total?: number) {
  await db.job.update({ where: { id: jobId }, data: { progress: done, ...(total != null ? { total } : {}) } });
}

async function runFinderSearch(job: Job) {
  const { searchId, autoCrawl } = job.payload as { searchId: string; autoCrawl?: boolean };
  const s = await db.finderSearch.update({ where: { id: searchId }, data: { status: "RUNNING" } });
  try {
    const secrets = await getSecrets();
    const hits =
      s.source === "google"
        ? await (async () => {
            if (!secrets.placesKey) throw new Error("Add a Google Places API key in Settings → Integrations, or use OpenStreetMap.");
            return searchPlaces(s.query, s.location, secrets.placesKey);
          })()
        : await searchOsm(s.query, s.location);
    if (hits.length) {
      await db.finderResult.createMany({
        data: hits.map((h) => ({
          searchId,
          name: h.name,
          category: h.category,
          address: h.address,
          city: h.city,
          country: h.country,
          phone: h.phone,
          website: h.website,
          domain: h.domain ?? null,
          rating: h.rating,
          reviews: h.reviews,
          lat: h.lat,
          lng: h.lng,
          emails: h.email ? [h.email.toLowerCase()] : [],
          crawlStatus: h.website ? "PENDING" : "NO_WEBSITE",
        })),
      });
    }
    await db.finderSearch.update({ where: { id: searchId }, data: { status: "DONE", resultCount: hits.length } });
    if (autoCrawl) {
      const ids = (await db.finderResult.findMany({ where: { searchId, crawlStatus: "PENDING" }, select: { id: true } })).map((r) => r.id);
      if (ids.length) await enqueue("FINDER_CRAWL", { resultIds: ids }, ids.length);
    }
    return { results: hits.length };
  } catch (e) {
    await db.finderSearch.update({ where: { id: searchId }, data: { status: "ERROR", error: (e as Error).message } });
    throw e;
  }
}

async function runCrawl(job: Job) {
  const { resultIds, extractPeople } = job.payload as { resultIds: string[]; extractPeople?: boolean };
  const useAi = extractPeople !== false && (await aiEnabled());
  const limit = pLimit(4);
  let done = 0;
  let found = 0;
  await Promise.all(
    resultIds.map((id) =>
      limit(async () => {
        const r = await db.finderResult.findUnique({ where: { id } });
        if (!r || !r.website) return;
        await db.finderResult.update({ where: { id }, data: { crawlStatus: "RUNNING" } });
        try {
          const c = await crawlWebsite(r.website);
          let contacts: { name: string; title: string; email: string }[] = [];
          if (useAi && c.text.length > 200) {
            try {
              contacts = await extractContactsFromPage(c.text, r.name);
            } catch (e) {
              console.warn("[crawl ai]", (e as Error).message);
            }
          }
          const emails = [...new Set([...r.emails, ...c.emails, ...contacts.map((x) => x.email.toLowerCase()).filter(Boolean)])];
          if (emails.length) found++;
          await db.finderResult.update({
            where: { id },
            data: { emails, socials: c.socials, contacts, phone: r.phone || c.phones[0] || null, crawlStatus: "DONE", crawlError: null },
          });
        } catch (e) {
          await db.finderResult.update({ where: { id }, data: { crawlStatus: "FAILED", crawlError: (e as Error).message.slice(0, 200) } });
        }
        done++;
        if (done % 3 === 0 || done === resultIds.length) await progress(job.id, done);
      }),
    ),
  );
  return { crawled: done, withEmail: found };
}

async function runVerify(job: Job) {
  const { leadIds } = job.payload as { leadIds: string[] };
  const limit = pLimit(3);
  let done = 0;
  const counts: Record<string, number> = {};
  await Promise.all(
    leadIds.map((id) =>
      limit(async () => {
        const lead = await db.lead.findUnique({ where: { id } });
        if (!lead) return;
        const r = await verifyEmail(lead.email);
        counts[r.status] = (counts[r.status] || 0) + 1;
        await db.lead.update({ where: { id }, data: { verifyStatus: r.status, verifiedAt: new Date() } });
        done++;
        if (done % 5 === 0 || done === leadIds.length) await progress(job.id, done);
      }),
    ),
  );
  return counts;
}

const HANDLERS: Record<string, (job: Job) => Promise<unknown>> = {
  FINDER_SEARCH: runFinderSearch,
  FINDER_CRAWL: runCrawl,
  VERIFY_LEADS: runVerify,
};

let running = 0;
export async function jobTick(maxConcurrent = 2) {
  if (running >= maxConcurrent) return;
  const job = await db.job.findFirst({ where: { status: "QUEUED", runAt: { lte: new Date() } }, orderBy: { createdAt: "asc" } });
  if (!job) return;
  const claimed = await db.job.updateMany({ where: { id: job.id, status: "QUEUED" }, data: { status: "RUNNING", startedAt: new Date() } });
  if (!claimed.count) return;
  running++;
  const handler = HANDLERS[job.type];
  (async () => {
    try {
      if (!handler) throw new Error(`Unknown job type ${job.type}`);
      const result = await handler(job);
      await db.job.update({ where: { id: job.id }, data: { status: "DONE", doneAt: new Date(), result: (result ?? {}) as Prisma.InputJsonValue } });
    } catch (e) {
      console.error(`[job ${job.type}]`, e);
      await db.job.update({ where: { id: job.id }, data: { status: "ERROR", error: (e as Error).message.slice(0, 500), doneAt: new Date() } });
    } finally {
      running--;
    }
  })();
}
