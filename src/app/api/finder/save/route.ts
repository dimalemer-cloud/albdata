import { z } from "zod";
import { api } from "@/lib/auth";
import { db } from "@/lib/db";
import { importLeads } from "@/lib/leads";

export const POST = api(async (req) => {
  const b = z
    .object({
      resultIds: z.array(z.string()).min(1),
      listId: z.string().optional(),
      newListName: z.string().optional(),
      clientId: z.string().nullish(),
      mode: z.enum(["best", "all"]).default("best"),
    })
    .parse(await req.json());
  const listId = b.listId || (await db.leadList.create({ data: { name: b.newListName || `Lead Finder ${new Date().toLocaleDateString()}`, clientId: b.clientId || null } })).id;
  const results = await db.finderResult.findMany({ where: { id: { in: b.resultIds } } });
  const leads: unknown[] = [];
  for (const r of results) {
    if (!r.emails.length) continue;
    const people = (r.contacts as { name: string; title: string; email: string }[]) || [];
    const emails = b.mode === "all" ? r.emails : [r.emails[0]];
    for (const email of emails) {
      const person = people.find((p) => p.email && p.email.toLowerCase() === email) || (emails.length === 1 && people.length === 1 ? people[0] : undefined);
      const [firstName, ...rest] = (person?.name || "").split(/\s+/);
      leads.push({
        email,
        firstName: firstName || null,
        lastName: rest.join(" ") || null,
        title: person?.title || null,
        companyName: r.name,
        website: r.website,
        phone: r.phone,
        city: r.city,
        country: r.country,
        source: "finder",
        customFields: {
          category: r.category || "",
          address: r.address || "",
          ...(r.rating != null ? { rating: String(r.rating) } : {}),
          ...(r.reviews != null ? { reviews: String(r.reviews) } : {}),
          ...Object.fromEntries(Object.entries((r.socials as Record<string, string>) || {}).map(([k, v]) => [k, v])),
        },
      });
    }
  }
  const out = await importLeads(listId, leads);
  await db.finderResult.updateMany({ where: { id: { in: b.resultIds }, NOT: { emails: { isEmpty: true } } }, data: { savedAt: new Date() } });
  return { ...out, listId, withoutEmail: results.filter((r) => !r.emails.length).length };
});
