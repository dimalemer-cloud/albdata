// Local test mail system for albdata: one SMTP server + one IMAP server per mailbox.
// Usage: MAILBOXES="a@agency.test:3143,b@agency.test:3144" OUTBOX=/tmp/outbox.jsonl node test/mailserver.mjs
// Every account: host 127.0.0.1, SMTP port 2525 (no TLS, any login), IMAP port per mailbox, password MAIL_PASSWORD (default testpass).
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const hoodiecrow = require("hoodiecrow-imap");
const { SMTPServer } = require("smtp-server");

const boxes = (process.env.MAILBOXES || "sender1@agency.test:3143,sender2@agency.test:3144")
  .split(",")
  .map((s) => s.trim().split(":"))
  .map(([email, port]) => ({ email: email.toLowerCase(), port: Number(port) }));
const outbox = process.env.OUTBOX || "./outbox.jsonl";
const spamEvery = Number(process.env.SPAM_EVERY || 0);

const storage = () => ({
  INBOX: {},
  "": {
    separator: "/",
    folders: {
      "[Gmail]": {
        flags: ["\\Noselect"],
        folders: { "All Mail": { "special-use": "\\All" }, Spam: { "special-use": "\\Junk" }, "Sent Mail": { "special-use": "\\Sent" } },
      },
    },
  },
});

const servers = new Map();
for (const b of boxes) {
  const s = hoodiecrow({
    plugins: ["ID", "ENABLE", "UIDPLUS", "MOVE", "SPECIAL-USE", "IDLE", "UNSELECT", "LITERALPLUS"],
    storage: storage(),
    users: { [b.email]: { password: process.env.MAIL_PASSWORD || "testpass" } },
  });
  s.listen(b.port);
  servers.set(b.email, { server: s, count: 0 });
  console.log(`IMAP ${b.email} on 127.0.0.1:${b.port}`);
}

const smtp = new SMTPServer({
  authOptional: true,
  disabledCommands: ["STARTTLS"],
  onAuth(auth, _session, cb) {
    cb(null, { user: auth.username });
  },
  onData(stream, session, cb) {
    const chunks = [];
    stream.on("data", (c) => chunks.push(c));
    stream.on("end", () => {
      const raw = Buffer.concat(chunks).toString("binary");
      for (const rcpt of session.envelope.rcptTo) {
        const to = rcpt.address.toLowerCase();
        const box = servers.get(to);
        if (box) {
          box.count++;
          const folder = spamEvery && box.count % spamEvery === 0 ? "[Gmail]/Spam" : "INBOX";
          box.server.appendMessage(folder, [], false, raw);
        } else {
          fs.appendFileSync(outbox, JSON.stringify({ from: session.envelope.mailFrom?.address, to, raw: Buffer.from(raw, "binary").toString("utf8"), at: new Date().toISOString() }) + "\n");
        }
      }
      cb();
    });
  },
});
smtp.listen(2525, "127.0.0.1", () => console.log("SMTP on 127.0.0.1:2525"));
