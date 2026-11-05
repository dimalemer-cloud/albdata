import nodemailer from "nodemailer";
import type { EmailAccount } from "@prisma/client";
import { decrypt } from "./crypto";
import { domainOf } from "./utils";
import crypto from "node:crypto";

export const PROVIDER_PRESETS = {
  google: { smtpHost: "smtp.gmail.com", smtpPort: 465, smtpSecure: true, imapHost: "imap.gmail.com", imapPort: 993, imapSecure: true },
  microsoft: { smtpHost: "smtp.office365.com", smtpPort: 587, smtpSecure: false, imapHost: "outlook.office365.com", imapPort: 993, imapSecure: true },
} as const;

type SmtpConfig = Pick<EmailAccount, "smtpHost" | "smtpPort" | "smtpSecure" | "username"> & { password: string };

export function transportFor(cfg: SmtpConfig) {
  return nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpSecure,
    auth: { user: cfg.username, pass: cfg.password },
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    tls: { minVersion: "TLSv1.2" },
  });
}

export function newMessageId(fromEmail: string) {
  return `<${crypto.randomUUID()}@${domainOf(fromEmail) || "albdata.local"}>`;
}

export async function sendMail(
  account: EmailAccount,
  mail: {
    to: string;
    subject: string;
    html?: string;
    text: string;
    messageId: string;
    inReplyTo?: string | null;
    references?: string | null;
    headers?: Record<string, string>;
  },
) {
  const t = transportFor({ ...account, password: decrypt(account.passwordEnc) });
  try {
    const info = await t.sendMail({
      from: { name: account.fromName, address: account.email },
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      messageId: mail.messageId,
      inReplyTo: mail.inReplyTo || undefined,
      references: mail.references || undefined,
      headers: mail.headers,
    });
    return info;
  } finally {
    t.close();
  }
}

/** Classify an SMTP error: is the recipient bad (bounce) or the account broken? */
export function classifySmtpError(e: unknown): "recipient" | "auth" | "temporary" {
  const err = e as { responseCode?: number; code?: string; message?: string };
  const msg = (err.message || "").toLowerCase();
  if (err.code === "EAUTH" || /auth|credentials|username and password|application-specific password/.test(msg)) return "auth";
  if (err.responseCode && err.responseCode >= 550 && err.responseCode < 560 && /recipient|user|mailbox|address|does not exist|no such/.test(msg)) return "recipient";
  if (err.code === "EENVELOPE") return "recipient";
  return "temporary";
}
