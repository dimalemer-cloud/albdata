import { db } from "../db";
import { newMessageId, sendMail } from "../mailer";
import { startOfUtcDay } from "../schedule";
import { pick } from "../utils";

const SUBJECTS = [
  "Quick follow up", "Catching up", "Thoughts on next week", "Notes from today", "Question about the plan", "Checking in",
  "Small update", "About Thursday", "Re: the document", "Ideas for the project", "Lunch next week?", "Following up on our chat",
  "Draft for review", "Weekend plans", "Schedule for Monday", "Feedback welcome", "Got a minute?", "Book recommendation",
  "The report you mentioned", "Coffee soon?", "Plan for the quarter", "Agenda for the call", "One more thing", "Quick favor",
  "Team offsite", "Our conversation earlier", "Timeline check", "Updated numbers", "New idea", "Recap",
];
const OPENERS = [
  "Hope your week is going well.", "Thanks for getting back to me earlier.", "Hope you had a good weekend.", "Just wanted to touch base.",
  "Good to hear from you.", "I was thinking about what you said yesterday.", "Hope things are calm on your end.", "Quick note before I forget.",
];
const MIDDLES = [
  "I went through the notes and most of it looks good to me.", "Could we move our call to later in the week?",
  "I think the second option makes more sense for now.", "Let me know if you need anything else from my side.",
  "I shared the file with the team and they had a few questions.", "The timeline seems realistic if we start next Monday.",
  "I'll put together a short summary and send it over.", "Did you get a chance to look at the draft?",
  "We should probably loop in the rest of the group soon.", "I found a couple of articles that might be useful.",
  "The meeting went well, everyone seemed aligned.", "I'm free Tuesday afternoon if that works.",
  "Happy to help with the review whenever you're ready.", "I'd keep it simple for the first version.",
  "Let's aim to wrap this up by the end of the month.", "Thanks again for the recommendation, it was great.",
  "I updated the spreadsheet with the latest numbers.", "Can you double check the dates on your side?",
];
const CLOSERS = ["Talk soon,", "Thanks,", "Best,", "Cheers,", "All the best,", "Speak soon,"];
const REPLIES = [
  "Thanks for the note, sounds good to me.", "Got it, I'll take a look today.", "Perfect, that works for me.",
  "Appreciate it. Let's go with that.", "Thanks! I'll get back to you shortly.", "Great, thanks for the update.",
  "Makes sense. Talk tomorrow.", "Sounds like a plan.", "Thanks, I've added it to my calendar.",
];

function compose(fromName: string, toName: string) {
  const first = fromName.split(" ")[0];
  const toFirst = toName.split(" ")[0];
  const n = 1 + Math.floor(Math.random() * 3);
  const mids = [...MIDDLES].sort(() => Math.random() - 0.5).slice(0, n);
  const text = `Hi ${toFirst},\n\n${pick(OPENERS)} ${mids.join(" ")}\n\n${pick(CLOSERS)}\n${first}`;
  return { subject: pick(SUBJECTS), text };
}

export function warmupTarget(acc: { warmupStart: number; warmupIncrement: number; warmupMax: number; warmupStartedAt: Date | null }) {
  const days = acc.warmupStartedAt ? Math.floor((Date.now() - acc.warmupStartedAt.getTime()) / 86_400_000) : 0;
  return Math.min(acc.warmupMax, acc.warmupStart + acc.warmupIncrement * days);
}

export async function warmupTick() {
  const pool = await db.emailAccount.findMany({ where: { warmupEnabled: true, status: "ACTIVE" } });
  if (pool.length < 2) return 0;
  let sent = 0;
  const dayStart = startOfUtcDay();
  // spread sends evenly through the day
  const minutes = (Date.now() - dayStart.getTime()) / 60_000;
  const fraction = Math.min(1, Math.max(0.05, minutes / 1440));

  for (const acc of pool) {
    const target = warmupTarget(acc);
    const sentToday = await db.warmupEmail.count({ where: { fromId: acc.id, isReply: false, sentAt: { gte: dayStart } } });
    if (sentToday >= Math.ceil(target * fraction) || Math.random() < 0.3) continue;
    const to = pick(pool.filter((p) => p.id !== acc.id));
    const { subject, text } = compose(acc.fromName, to.fromName);
    const messageId = newMessageId(acc.email);
    try {
      await sendMail(acc, { to: to.email, subject, text, messageId });
      await db.warmupEmail.create({ data: { fromId: acc.id, toId: to.id, messageId, subject } });
      sent++;
    } catch (e) {
      console.error(`[warmup ${acc.email}]`, (e as Error).message);
    }
  }

  // Replies that are due
  const due = await db.warmupEmail.findMany({
    where: { replyDueAt: { lte: new Date() }, repliedAt: null },
    include: { from: true, to: true },
    take: 50,
  });
  for (const w of due) {
    if (w.to.status !== "ACTIVE" || !w.to.warmupEnabled) {
      await db.warmupEmail.update({ where: { id: w.id }, data: { repliedAt: new Date() } });
      continue;
    }
    const messageId = newMessageId(w.to.email);
    const text = `${pick(REPLIES)}\n\n${w.to.fromName.split(" ")[0]}`;
    const subject = /^re:/i.test(w.subject) ? w.subject : `Re: ${w.subject}`;
    try {
      await sendMail(w.to, { to: w.from.email, subject, text, messageId, inReplyTo: w.messageId, references: w.messageId });
      await db.warmupEmail.create({ data: { fromId: w.toId, toId: w.fromId, messageId, subject, isReply: true, parentId: w.id } });
      await db.warmupEmail.update({ where: { id: w.id }, data: { repliedAt: new Date() } });
      sent++;
    } catch (e) {
      console.error(`[warmup reply ${w.to.email}]`, (e as Error).message);
    }
  }
  return sent;
}

/** Inbox placement health for emails sent by an account (last 14 days). */
export async function warmupHealth(accountId: string) {
  const since = new Date(Date.now() - 14 * 86_400_000);
  const [inbox, spam, sent, received] = await Promise.all([
    db.warmupEmail.count({ where: { fromId: accountId, landedIn: "INBOX", sentAt: { gte: since } } }),
    db.warmupEmail.count({ where: { fromId: accountId, landedIn: "SPAM", sentAt: { gte: since } } }),
    db.warmupEmail.count({ where: { fromId: accountId, sentAt: { gte: since } } }),
    db.warmupEmail.count({ where: { toId: accountId, sentAt: { gte: since } } }),
  ]);
  const landed = inbox + spam;
  return { inbox, spam, sent, received, score: landed ? Math.round((inbox / landed) * 100) : null };
}
