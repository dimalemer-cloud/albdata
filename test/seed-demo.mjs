// Adds realistic demo data for previews/screenshots. Run: node --env-file=.env test/seed-demo.mjs
import { createRequire } from "node:module";
import crypto from "node:crypto";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const enc = (plain) => {
  const key = crypto.createHash("sha256").update(process.env.ENCRYPTION_KEY).digest();
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const e = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), e].map((b) => b.toString("base64")).join(".");
};
const rnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = (d, h = rnd(8, 17)) => new Date(Date.now() - d * 86400000 - (24 - h) * 3600000 + rnd(0, 3000000));

const FIRST = ["Arben", "Elira", "Klodi", "Besa", "Dritan", "Anisa", "Gent", "Jonida", "Luan", "Ornela", "Sokol", "Teuta", "Marco", "Giulia", "John", "Emily", "Lukas", "Sofia", "Daniel", "Hannah"];
const LAST = ["Hoxha", "Krasniqi", "Berisha", "Shehu", "Leka", "Gashi", "Rossi", "Smith", "Müller", "Bianchi", "Brown", "Kola"];
const BIZ = {
  dentists: ["Smile Dental", "Bright Teeth Clinic", "DentaCare", "Perla Dental", "City Dental Studio", "White Line Dental", "Alba Dent", "Dr. Dent Tirana"],
  realestate: ["Prime Estates", "Tirana Homes", "Blue Coast Realty", "Urban Nest", "Keyline Properties", "Adriatic Living"],
  restaurants: ["Mullixhiu", "Oda Restaurant", "Salt & Olive", "Era Vila", "Kantina e Fshatit", "Sofra Blu"],
  gyms: ["IronHouse Gym", "FitZone", "Pulse Fitness", "Core Studio", "Atlas Training Club"],
};
const CITIES = ["Tirana", "Durrës", "Vlorë", "Shkodër", "Milan", "Vienna", "Munich", "London"];

async function main() {
  if ((await db.campaign.count()) > 0 && !process.argv.includes("--force")) {
    console.log("Demo data already present (use --force to add more).");
    return db.$disconnect();
  }
  if ((await db.user.count()) === 0) {
    const [email, password] = (process.env.DEMO_LOGIN || "demo@albdata.test:albdata-demo").split(":");
    const bcrypt = require("bcryptjs");
    await db.user.create({ data: { email, name: "Demo Owner", role: "OWNER", passwordHash: await bcrypt.hash(password, 10) } });
    await db.workspace.upsert({ where: { id: "default" }, update: {}, create: { id: "default", name: "albdata" } });
    console.log(`Created demo login ${email}`);
  }
  const owner = await db.user.findFirst({ where: { role: "OWNER" } });
  // Clients
  const clients = [];
  for (const [name, website] of [["Smile Group Dental", "smilegroup.al"], ["Prime Estates", "prime-estates.al"], ["Mullixhiu Hospitality", "mullixhiu.al"]]) {
    clients.push(await db.client.upsert({ where: { id: `demo-${name.replace(/\W/g, "")}` }, update: {}, create: { id: `demo-${name.replace(/\W/g, "")}`, name, website } }));
  }
  // Inboxes on the local test mail server
  const inboxes = [];
  const defs = [["alex@albgrowth-mail.test", "Alex Morina", 3145], ["sara@albgrowth-mail.test", "Sara Hoxha", 3146], ["erion@getalbdata.test", "Erion Leka", 3147], ["mira@getalbdata.test", "Mira Kola", 3148]];
  for (const [email, fromName, port] of defs) {
    inboxes.push(await db.emailAccount.upsert({
      where: { email },
      update: {},
      create: { email, fromName, provider: "custom", smtpHost: "127.0.0.1", smtpPort: 2525, smtpSecure: false, imapHost: "127.0.0.1", imapPort: port, imapSecure: false, username: email, passwordEnc: enc("testpass"), dailyLimit: 40, minGapMinutes: 9, warmupEnabled: true, warmupStartedAt: daysAgo(rnd(12, 24)), warmupMax: 30, tags: [email.includes("albgrowth") ? "albgrowth" : "getalbdata"], signature: `${fromName.split(" ")[0]}\nGrowth team · alboutreach`, lastSyncAt: new Date() },
    }));
  }
  const allInboxes = await db.emailAccount.findMany();
  // Warmup history (14 days)
  const wrows = [];
  for (let d = 13; d >= 0; d--) for (const a of allInboxes) {
    const n = Math.min(30, 4 + (13 - d) * 2);
    for (let i = 0; i < n; i++) {
      const to = pick(allInboxes.filter((x) => x.id !== a.id));
      wrows.push({ fromId: a.id, toId: to.id, messageId: `<demo-w-${crypto.randomUUID()}@demo>`, subject: "Catching up", sentAt: daysAgo(d), landedIn: Math.random() < 0.94 ? "INBOX" : "SPAM", processedAt: daysAgo(d), isReply: Math.random() < 0.35 });
    }
  }
  await db.warmupEmail.createMany({ data: wrows });

  // Lists + leads + campaigns
  const camps = [
    { name: "Dentists Albania – New patient website", key: "dentists", client: clients[0], status: "ACTIVE", leads: 180, ageDays: 24, open: 0.58, reply: 0.09, pos: 0.42 },
    { name: "Real estate agencies – Lead gen offer", key: "realestate", client: clients[1], status: "ACTIVE", leads: 140, ageDays: 16, open: 0.51, reply: 0.07, pos: 0.38 },
    { name: "Restaurants Tirana – Google reviews", key: "restaurants", client: clients[2], status: "PAUSED", leads: 90, ageDays: 28, open: 0.46, reply: 0.05, pos: 0.3 },
    { name: "Gyms – Membership growth (EU)", key: "gyms", client: null, status: "COMPLETED", leads: 70, ageDays: 30, open: 0.55, reply: 0.08, pos: 0.35 },
    { name: "Q1 agency partnerships", key: "realestate", client: null, status: "DRAFT", leads: 0, ageDays: 1, open: 0, reply: 0, pos: 0 },
  ];
  const REPLIES = {
    INTERESTED: ["Hi, sounds interesting. What would this cost for a clinic our size?", "Yes, we've been thinking about redoing our website. Can you send examples?", "Interesting timing — can we talk next week?", "Please send more details and pricing.", "We'd like to know more. Are you available Thursday?"],
    MEETING_BOOKED: ["Booked a slot for Tuesday 11:00 via your link. Talk then!", "Thursday 3pm works, see you then."],
    NOT_INTERESTED: ["Thanks, but we already work with an agency.", "Not interested at the moment.", "No thank you."],
    OUT_OF_OFFICE: ["I am out of the office until Monday with limited access to email."],
    WRONG_PERSON: ["I'm not the right person, please contact our manager Elira."],
    NEUTRAL: ["Who gave you my email?", "What exactly do you do?"],
  };
  for (const cdef of camps) {
    const list = await db.leadList.create({ data: { name: `${cdef.name.split("–")[0].trim()} – leads`, clientId: cdef.client?.id ?? null, createdAt: daysAgo(cdef.ageDays + 1) } });
    const leads = [];
    for (let i = 0; i < Math.max(cdef.leads, 25); i++) {
      const first = pick(FIRST), last = pick(LAST), biz = `${pick(BIZ[cdef.key])}${i > 7 ? ` ${pick(CITIES)}` : ""}`;
      const domain = biz.toLowerCase().replace(/[^a-z]/g, "").slice(0, 18) + i + ".test";
      leads.push({ listId: list.id, email: `${first.toLowerCase().replace(/ü/g, "u")}@${domain}`, firstName: first, lastName: last, companyName: biz, city: pick(CITIES), website: `https://${domain}`, title: pick(["Owner", "Founder", "Manager", "Director", "Dr."]), source: pick(["finder", "csv", "finder"]), verifyStatus: pick(["valid", "valid", "valid", "catch_all", "unknown", null]), status: "NEW", createdAt: daysAgo(cdef.ageDays + 1) });
    }
    await db.lead.createMany({ data: leads, skipDuplicates: true });
    if (!cdef.leads) continue;
    const dbLeads = await db.lead.findMany({ where: { listId: list.id } });
    const c = await db.campaign.create({
      data: {
        name: cdef.name, clientId: cdef.client?.id ?? null, status: cdef.status, timezone: "Europe/Tirane", dailyLimit: 120, createdAt: daysAgo(cdef.ageDays + 1), launchedAt: daysAgo(cdef.ageDays),
        steps: { create: [
          { order: 0, delayDays: 0, variants: { create: [
            { label: "A", subject: "{Quick|Short} question about {{companyName}}", body: "Hi {{firstName|there}},\n\nI noticed {{companyName}} doesn't offer online booking yet. Clinics we work with in {{city}} get 20–30 extra patient requests a month after adding it.\n\nWorth a quick 10-minute chat?\n\n{{senderFirstName}}" },
            { label: "B", subject: "{{companyName}} + more patients", body: "Hey {{firstName|there}}, quick idea to bring {{companyName}} more new patients from Google — mind if I send a 2-minute video?" },
          ] } },
          { order: 1, delayDays: 3, variants: { create: [{ label: "A", subject: "", body: "Hi {{firstName|there}}, just bumping this up — happy to share examples from {{city}}." }] } },
          { order: 2, delayDays: 4, variants: { create: [{ label: "A", subject: "", body: "Last note from me, {{firstName|there}}. Should I close your file?" }] } },
        ] },
        accounts: { create: inboxes.map((a) => ({ accountId: a.id })) },
      },
      include: { steps: { include: { variants: true }, orderBy: { order: "asc" } } },
    });
    const events = [];
    for (const [idx, lead] of dbLeads.entries()) {
      const acc = inboxes[idx % inboxes.length];
      const startDay = Math.max(0, cdef.ageDays - Math.floor((idx / dbLeads.length) * cdef.ageDays));
      const replied = Math.random() < cdef.reply;
      const stepsSent = replied ? rnd(1, 2) : cdef.status === "COMPLETED" ? 3 : Math.min(3, 1 + Math.floor(startDay / 4));
      const bounced = !replied && Math.random() < 0.015;
      let status = bounced ? "BOUNCED" : replied ? "REPLIED" : stepsSent >= 3 ? "COMPLETED" : "ACTIVE";
      const cl = await db.campaignLead.create({ data: { campaignId: c.id, leadId: lead.id, status, currentStep: stepsSent, accountId: acc.id, nextSendAt: status === "ACTIVE" ? new Date(Date.now() + rnd(1, 4) * 86400000) : null, lastSubject: `Quick question about ${lead.companyName}`, createdAt: daysAgo(startDay + 1) } });
      for (let s = 0; s < stepsSent; s++) {
        const day = Math.max(0, startDay - s * 3);
        const v = c.steps[s].variants[s === 0 ? idx % 2 : 0];
        events.push({ type: "SENT", campaignId: c.id, campaignLeadId: cl.id, accountId: acc.id, stepIndex: s, variantId: v.id, createdAt: daysAgo(day) });
        if (Math.random() < cdef.open / (s + 1)) events.push({ type: "OPEN", campaignId: c.id, campaignLeadId: cl.id, accountId: acc.id, stepIndex: s, variantId: v.id, createdAt: daysAgo(Math.max(0, day - rnd(0, 1))) });
        if (s === 0 && Math.random() < 0.04) events.push({ type: "CLICK", campaignId: c.id, campaignLeadId: cl.id, accountId: acc.id, stepIndex: s, variantId: v.id, createdAt: daysAgo(day) });
      }
      if (bounced) events.push({ type: "BOUNCE", campaignId: c.id, campaignLeadId: cl.id, accountId: acc.id, stepIndex: 0, createdAt: daysAgo(startDay) });
      if (replied) {
        const r = Math.random();
        const cat = r < cdef.pos ? (Math.random() < 0.3 ? "MEETING_BOOKED" : "INTERESTED") : r < cdef.pos + 0.3 ? "NOT_INTERESTED" : pick(["OUT_OF_OFFICE", "WRONG_PERSON", "NEUTRAL"]);
        const replyDay = Math.max(0, startDay - rnd(0, 3));
        const v = c.steps[0].variants[idx % 2];
        events.push({ type: cat === "OUT_OF_OFFICE" ? "AUTO_REPLY" : "REPLY", campaignId: c.id, campaignLeadId: cl.id, accountId: acc.id, stepIndex: 0, variantId: v.id, createdAt: daysAgo(replyDay) });
        if (cat === "INTERESTED" || cat === "MEETING_BOOKED") events.push({ type: "INTERESTED", campaignId: c.id, campaignLeadId: cl.id, accountId: acc.id, createdAt: daysAgo(replyDay) });
        await db.campaignLead.update({ where: { id: cl.id }, data: { interest: cat } });
        await db.lead.update({ where: { id: lead.id }, data: { status: { INTERESTED: "INTERESTED", MEETING_BOOKED: "MEETING_BOOKED", NOT_INTERESTED: "NOT_INTERESTED" }[cat] || "REPLIED" } });
        const subject = `Quick question about ${lead.companyName}`;
        const t = await db.thread.create({ data: { accountId: acc.id, leadId: lead.id, campaignId: c.id, subject, contactEmail: lead.email, contactName: `${lead.firstName} ${lead.lastName}`, interest: cat, unread: replyDay < 2, hasReply: true, lastMessageAt: daysAgo(replyDay) } });
        await db.message.create({ data: { direction: "OUTBOUND", accountId: acc.id, threadId: t.id, campaignId: c.id, campaignLeadId: cl.id, leadId: lead.id, stepIndex: 0, variantId: v.id, fromEmail: acc.email, fromName: acc.fromName, toEmail: lead.email, subject, bodyHtml: `<div>Hi ${lead.firstName},<br><br>I noticed ${lead.companyName} doesn't offer online booking yet. Clinics we work with get 20–30 extra patient requests a month after adding it.<br><br>Worth a quick 10-minute chat?<br><br>${acc.fromName.split(" ")[0]}</div>`, bodyText: "", sentAt: daysAgo(startDay), openCount: rnd(1, 4), openedAt: daysAgo(startDay) } });
        await db.message.create({ data: { direction: "INBOUND", accountId: acc.id, threadId: t.id, campaignId: c.id, campaignLeadId: cl.id, leadId: lead.id, fromEmail: lead.email, fromName: `${lead.firstName} ${lead.lastName}`, toEmail: acc.email, subject: `Re: ${subject}`, bodyHtml: "", bodyText: `${pick(REPLIES[cat])}\n\n${lead.firstName}`, isAutoReply: cat === "OUT_OF_OFFICE", category: cat, sentAt: daysAgo(replyDay) } });
        if (cat === "INTERESTED" || cat === "MEETING_BOOKED") {
          const stage = cat === "MEETING_BOOKED" ? pick(["meeting", "proposal", "won"]) : pick(["interested", "interested", "meeting", "lost"]);
          await db.deal.create({ data: { title: lead.companyName, stage, value: pick([900, 1200, 1500, 2400, 3000, 4500]), leadId: lead.id, campaignId: c.id, clientId: cdef.client?.id ?? null, ownerId: owner?.id, notes: stage === "won" ? "Signed 6-month retainer." : "" } });
        }
      }
    }
    for (let i = 0; i < events.length; i += 1000) await db.event.createMany({ data: events.slice(i, i + 1000) });
    console.log(`${cdef.name}: ${dbLeads.length} leads, ${events.filter((e) => e.type === "SENT").length} sent`);
  }
  // Lead finder demo search
  const s = await db.finderSearch.create({ data: { query: "dentists", location: "Tirana, Albania", source: "osm", status: "DONE", resultCount: 8, createdAt: daysAgo(2) } });
  const people = [["Dr. Elira Shehu", "Founder & Lead Dentist"], ["Arben Gashi", "Owner"], ["Teuta Krasniqi", "Clinic Manager"]];
  await db.finderResult.createMany({ data: BIZ.dentists.map((name, i) => {
    const d = name.toLowerCase().replace(/[^a-z]/g, "") + ".al";
    return { searchId: s.id, name, category: "dentist", city: "Tirana", address: `Rruga ${pick(["Myslym Shyri", "Ibrahim Rugova", "Dëshmorët e Kombit", "Elbasanit"])} ${rnd(1, 120)}, Tirana`, phone: `+355 69 ${rnd(100, 999)} ${rnd(1000, 9999)}`, website: i === 6 ? null : `https://${d}`, domain: i === 6 ? null : d, rating: i === 6 ? null : Math.round((4 + Math.random()) * 10) / 10, reviews: rnd(12, 340), emails: i === 6 ? [] : i === 4 ? [] : [`${pick(["info", "contact", "kontakt"])}@${d}`, ...(i % 2 ? [`${pick(["elira", "arben", "teuta"])}@${d}`] : [])], contacts: i % 3 === 0 ? [{ name: people[i % 3][0], title: people[i % 3][1], email: "" }] : [], socials: { facebook: `https://facebook.com/${d}`, ...(i % 2 ? { instagram: `https://instagram.com/${d}` } : {}) }, crawlStatus: i === 6 ? "NO_WEBSITE" : "DONE" };
  }) });
  await db.workspace.update({ where: { id: "default" }, data: { defaultTimezone: "Europe/Tirane" } });
  console.log("demo data ready");
  await db.$disconnect();
}
main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
