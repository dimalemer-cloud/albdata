import { z } from "zod";
import { PROVIDER_PRESETS, transportFor } from "./mailer";
import { testImap } from "./engine/inbox";

export const accountInput = z.object({
  email: z.string().email(),
  fromName: z.string().min(1, "Sender name is required"),
  password: z.string().min(1, "App password is required"),
  provider: z.enum(["google", "microsoft", "custom"]).default("google"),
  username: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().optional(),
  smtpSecure: z.boolean().optional(),
  imapHost: z.string().optional(),
  imapPort: z.coerce.number().optional(),
  imapSecure: z.boolean().optional(),
  dailyLimit: z.coerce.number().int().min(1).max(500).optional(),
  minGapMinutes: z.coerce.number().int().min(1).max(240).optional(),
  signature: z.string().optional(),
  tags: z.array(z.string()).optional(),
  warmupEnabled: z.boolean().optional(),
});

export function resolveServer(input: z.infer<typeof accountInput>) {
  const preset = input.provider === "custom" ? null : PROVIDER_PRESETS[input.provider];
  const cfg = {
    smtpHost: input.smtpHost || preset?.smtpHost || "",
    smtpPort: input.smtpPort || preset?.smtpPort || 465,
    smtpSecure: input.smtpSecure ?? preset?.smtpSecure ?? true,
    imapHost: input.imapHost || preset?.imapHost || "",
    imapPort: input.imapPort || preset?.imapPort || 993,
    imapSecure: input.imapSecure ?? preset?.imapSecure ?? true,
    username: input.username || input.email,
  };
  if (!cfg.smtpHost || !cfg.imapHost) throw new Error("SMTP and IMAP hosts are required for custom accounts");
  return cfg;
}

export async function testConnection(cfg: ReturnType<typeof resolveServer>, password: string) {
  const smtp = transportFor({ ...cfg, password });
  try {
    await smtp.verify();
  } catch (e) {
    throw new Error(`SMTP login failed: ${(e as Error).message}. For Gmail use an App Password (Google Account → Security → 2-Step Verification → App passwords).`);
  } finally {
    smtp.close();
  }
  try {
    await testImap(cfg, password);
  } catch (e) {
    throw new Error(`IMAP login failed: ${(e as Error).message}. Make sure IMAP is enabled in Gmail settings.`);
  }
}

export function strip<T extends { passwordEnc: string }>(a: T) {
  const { passwordEnc: _p, ...rest } = a;
  return rest;
}
