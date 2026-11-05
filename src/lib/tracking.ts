import { trackingBase, appUrl } from "./workspace";

export function b64url(s: string) {
  return Buffer.from(s, "utf8").toString("base64url");
}

export async function applyTracking(
  html: string,
  messageDbId: string,
  opts: { open: boolean; click: boolean; unsubscribe: boolean; unsubText?: string },
) {
  const base = await trackingBase();
  let out = html;
  if (opts.click) {
    out = out.replace(/href="(https?:\/\/[^"]+)"/gi, (_, url: string) => `href="${base}/t/c/${messageDbId}?u=${b64url(url)}"`);
  }
  if (opts.unsubscribe) {
    const text = opts.unsubText || "If you'd rather not hear from me, just let me know";
    out += `<div style="font-family:Arial,sans-serif;font-size:11px;color:#888;margin-top:18px"><a href="${unsubscribeUrl(base, messageDbId)}" style="color:#888">${text}</a>.</div>`;
  }
  if (opts.open) {
    out += `<img src="${base}/t/o/${messageDbId}.gif" width="1" height="1" alt="" style="display:none">`;
  }
  return out;
}

export function unsubscribeUrl(base: string, messageDbId: string) {
  return `${base}/u/${messageDbId}`;
}

export function unsubscribeHeaders(messageDbId: string, fromEmail: string) {
  const url = `${appUrl()}/u/${messageDbId}`;
  return {
    "List-Unsubscribe": `<${url}>, <mailto:${fromEmail}?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
