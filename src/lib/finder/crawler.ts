import * as cheerio from "cheerio";
import { normalizeDomain } from "../utils";
import { ROLE } from "../verify";

const UA = "Mozilla/5.0 (compatible; albdata-crawler/1.0; +https://albdata.app)";
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi;
const BAD_EMAIL = /\.(png|jpe?g|gif|svg|webp|css|js)$|example\.|sentry|wixpress|@sentry|godaddy|domain\.com|email\.com|yourname|@2x|placeholder|cloudflare|schema\.org|w3\.org/i;
const CONTACT_HINT = /contact|kontakt|about|team|staff|our-?people|impressum|imprint|leadership|who-we-are|meet|doctors|practitioners|reach|location/i;
const SOCIAL: Record<string, RegExp> = {
  facebook: /facebook\.com\/[^"'\s?#]+/i,
  instagram: /instagram\.com\/[^"'\s?#]+/i,
  linkedin: /linkedin\.com\/(company|in)\/[^"'\s?#]+/i,
  twitter: /(twitter|x)\.com\/[A-Za-z0-9_]+/i,
  youtube: /youtube\.com\/(channel|c|user|@)[^"'\s?#]*/i,
  tiktok: /tiktok\.com\/@[^"'\s?#]+/i,
};

async function fetchPage(url: string, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow", signal: ctrl.signal });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.includes("html")) return null;
    const reader = res.body?.getReader();
    if (!reader) return null;
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      chunks.push(value);
      if (size > 2_000_000) break;
    }
    return { html: Buffer.concat(chunks).toString("utf8"), finalUrl: res.url };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function decodeCfEmail(hex: string) {
  const key = parseInt(hex.slice(0, 2), 16);
  let out = "";
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  return out;
}

function extract(html: string, baseUrl: string) {
  const $ = cheerio.load(html);
  const emails = new Set<string>();
  $('a[href^="mailto:"]').each((_, el) => {
    const v = decodeURIComponent(($(el).attr("href") || "").replace(/^mailto:/i, "").split("?")[0]);
    if (v) emails.add(v.toLowerCase().trim());
  });
  $("[data-cfemail]").each((_, el) => {
    try {
      emails.add(decodeCfEmail($(el).attr("data-cfemail") || "").toLowerCase());
    } catch {}
  });
  $("script, style, noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ");
  const deob = text.replace(/\s*[\[(]\s*at\s*[\])]\s*/gi, "@").replace(/\s*[\[(]\s*dot\s*[\])]\s*/gi, ".");
  for (const m of deob.match(EMAIL_RE) || []) emails.add(m.toLowerCase());
  for (const m of html.match(EMAIL_RE) || []) emails.add(m.toLowerCase());

  const phones = new Set<string>();
  $('a[href^="tel:"]').each((_, el) => {
    phones.add(($(el).attr("href") || "").replace(/^tel:/i, "").trim());
  });

  const socials: Record<string, string> = {};
  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    for (const [k, re] of Object.entries(SOCIAL)) {
      if (!socials[k]) {
        const m = href.match(re);
        if (m) socials[k] = `https://${m[0]}`;
      }
    }
    try {
      const u = new URL(href, baseUrl);
      if (u.protocol.startsWith("http")) links.push(u.toString().split("#")[0]);
    } catch {}
  });
  const title = $("title").first().text().trim();
  return { emails, phones, socials, links, text: text.slice(0, 30000), title };
}

export type CrawlResult = {
  emails: string[];
  phones: string[];
  socials: Record<string, string>;
  pagesVisited: string[];
  text: string;
};

/** Crawl homepage + up to N contact/about/team pages on the same domain. */
export async function crawlWebsite(website: string, maxPages = 6): Promise<CrawlResult> {
  const start = website.startsWith("http") ? website : `https://${website}`;
  const domain = normalizeDomain(start);
  const home = await fetchPage(start);
  if (!home) throw new Error("Website unreachable");
  const first = extract(home.html, home.finalUrl);
  const emails = new Set(first.emails);
  const phones = new Set(first.phones);
  const socials = { ...first.socials };
  const visited = [home.finalUrl];
  let text = `${first.title}\n${first.text}`;

  const candidates = [...new Set(first.links)]
    .filter((l) => normalizeDomain(l) === domain && CONTACT_HINT.test(new URL(l).pathname))
    .slice(0, maxPages - 1);
  for (const url of candidates) {
    const page = await fetchPage(url);
    if (!page) continue;
    const r = extract(page.html, page.finalUrl);
    r.emails.forEach((e) => emails.add(e));
    r.phones.forEach((p) => phones.add(p));
    Object.assign(socials, { ...r.socials, ...socials });
    visited.push(page.finalUrl);
    text += `\n\n[${new URL(page.finalUrl).pathname}]\n${r.text.slice(0, 8000)}`;
  }

  const clean = [...emails].filter((e) => !BAD_EMAIL.test(e) && e.length < 80);
  // Rank: company's own domain first, then personal addresses before role ones (info@, booking@…)
  const score = (e: string) => (e.endsWith(`@${domain}`) ? 2 : 0) + (ROLE.has(e.split("@")[0]) ? 0 : 1);
  clean.sort((a, b) => score(b) - score(a));
  return { emails: clean.slice(0, 15), phones: [...phones].slice(0, 5), socials, pagesVisited: visited, text: text.slice(0, 40000) };
}
