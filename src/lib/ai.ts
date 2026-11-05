import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { getSecrets } from "./workspace";

export const AI_MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (best quality)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (balanced)" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (fastest, cheapest)" },
];

export class AiNotConfigured extends Error {
  constructor() {
    super("AI is not configured. Add your Claude API key in Settings → Integrations.");
  }
}

async function client() {
  const s = await getSecrets();
  if (!s.anthropicKey) throw new AiNotConfigured();
  return { client: new Anthropic({ apiKey: s.anthropicKey }), model: s.aiModel || "claude-opus-5-5" };
}

export async function aiEnabled() {
  return !!(await getSecrets()).anthropicKey;
}

type Effort = "low" | "medium" | "high";

/** One structured-output call with server-side refusal fallback enabled. */
async function structured<T extends z.ZodType>(opts: {
  system: string;
  prompt: string;
  schema: T;
  effort?: Effort;
  maxTokens?: number;
}): Promise<z.infer<T>> {
  const { client: c, model } = await client();
  const res = await c.beta.messages.parse({
    model,
    max_tokens: opts.maxTokens ?? 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
    output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(opts.schema) },
  });
  if (res.stop_reason === "refusal") throw new Error("The AI declined this request.");
  if (res.stop_reason === "max_tokens") throw new Error("The AI response was cut off. Try a shorter input.");
  if (!res.parsed_output) throw new Error("The AI returned an unexpected response.");
  return res.parsed_output as z.infer<T>;
}

const COPY_RULES = `Cold email rules you always follow:
- Short: 50-120 words per email. Plain text, no markdown, no bullet symbols unless natural.
- Conversational, specific, no hype, no spam-trigger words, no exclamation marks, at most one link.
- Personalize with variables in double curly braces: {{firstName}}, {{companyName}}, {{city}}, {{website}}. Give a fallback where a value might be missing, e.g. {{firstName|there}}.
- One clear, low-friction call to action (a question, not a demand).
- Follow-ups are shorter than the first email and add a new angle; follow-up subject lines are empty so they thread as a reply.
- Never invent facts about the recipient.`;

export async function generateSequence(input: {
  offer: string;
  audience: string;
  tone?: string;
  steps?: number;
  senderName?: string;
}) {
  const schema = z.object({
    steps: z.array(
      z.object({
        delayDays: z.number().int().describe("Days to wait after the previous step. 0 for the first step."),
        subject: z.string().describe("Subject line. Empty string for follow-ups that should thread as replies."),
        body: z.string(),
        variantBSubject: z.string().describe("Alternative subject for A/B testing. Empty for follow-ups."),
        variantBBody: z.string().describe("Alternative body for A/B testing with a different angle."),
      }),
    ),
  });
  return structured({
    system: `You are an expert cold email copywriter for a lead-generation agency.\n${COPY_RULES}`,
    prompt: `Write a ${input.steps ?? 3}-step cold email sequence.\n\nWhat we offer:\n${input.offer}\n\nWho we target:\n${input.audience}\n\nTone: ${input.tone || "friendly, professional, concise"}\nSender name: ${input.senderName || "{{senderFirstName}}"}\n\nUse typical delays (first step 0, then 2-4 days).`,
    schema,
    effort: "medium",
  });
}

export async function rewriteCopy(text: string, instruction: string) {
  const schema = z.object({ subject: z.string(), body: z.string() });
  return structured({
    system: `You edit cold emails.\n${COPY_RULES}\nKeep all {{variables}} that exist in the input.`,
    prompt: `Instruction: ${instruction}\n\nEmail (first line may start with "Subject:"):\n${text}`,
    schema,
    effort: "medium",
  });
}

export const REPLY_CATEGORIES = [
  "INTERESTED", "MEETING_BOOKED", "NOT_INTERESTED", "OUT_OF_OFFICE", "WRONG_PERSON", "UNSUBSCRIBE", "NEUTRAL",
] as const;

export async function categorizeReply(reply: string, originalEmail?: string) {
  const schema = z.object({
    category: z.enum(REPLY_CATEGORIES),
    summary: z.string().describe("One short sentence summarizing the reply."),
  });
  return structured({
    system: `You classify replies to cold outreach emails for a sales team.
Categories:
- INTERESTED: wants to learn more, asks questions about the offer, price, or next steps.
- MEETING_BOOKED: agrees to a specific call/meeting time or confirms a booking.
- NOT_INTERESTED: declines, not a fit, already has a provider.
- OUT_OF_OFFICE: automatic away / vacation / leave message.
- WRONG_PERSON: says they're not the right contact or refers to someone else.
- UNSUBSCRIBE: asks to be removed or to stop emailing.
- NEUTRAL: anything else.`,
    prompt: `${originalEmail ? `Our email:\n${originalEmail.slice(0, 3000)}\n\n` : ""}Their reply:\n${reply.slice(0, 6000)}`,
    schema,
    effort: "low",
    maxTokens: 2000,
  });
}

export async function draftReply(input: {
  thread: { from: "us" | "them"; text: string }[];
  senderName: string;
  context?: string;
}) {
  const schema = z.object({ body: z.string() });
  const convo = input.thread.map((m) => `${m.from === "us" ? "US" : "PROSPECT"}:\n${m.text.slice(0, 3000)}`).join("\n\n---\n\n");
  return structured({
    system: `You write replies to prospects on behalf of ${input.senderName}, a sales rep at a lead-generation agency. Be brief (under 90 words), warm, and move toward booking a call. Plain text. Sign off with the sender's first name. Never invent prices, dates, or facts not in the conversation or context; if needed, propose a short call instead.`,
    prompt: `${input.context ? `Context about our offer:\n${input.context}\n\n` : ""}Conversation so far (latest last):\n\n${convo}\n\nWrite our next reply.`,
    schema,
    effort: "medium",
  });
}

export async function extractContactsFromPage(pageText: string, companyName: string) {
  const schema = z.object({
    contacts: z.array(
      z.object({
        name: z.string(),
        title: z.string().describe("Job title/role, or empty string if unknown."),
        email: z.string().describe("Their email if shown on the page, else empty string."),
      }),
    ),
  });
  const out = await structured({
    system: "You extract real people (owners, founders, managers, doctors, partners, staff) listed on a business website. Only include people explicitly named on the page. Never invent anyone.",
    prompt: `Business: ${companyName}\n\nWebsite text:\n${pageText.slice(0, 20000)}`,
    schema,
    effort: "low",
    maxTokens: 3000,
  });
  return out.contacts.slice(0, 15);
}
