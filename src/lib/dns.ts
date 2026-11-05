import dns from "node:dns/promises";

async function txt(name: string) {
  try {
    return (await dns.resolveTxt(name)).map((r) => r.join(""));
  } catch {
    return [];
  }
}

export async function mxRecords(domain: string) {
  try {
    const mx = await dns.resolveMx(domain);
    return mx.sort((a, b) => a.priority - b.priority).map((m) => m.exchange);
  } catch {
    return [];
  }
}

/** Deliverability DNS check for a sending domain. */
export async function checkDomainDns(domain: string) {
  const [mx, root, dmarc, dkimGoogle] = await Promise.all([
    mxRecords(domain),
    txt(domain),
    txt(`_dmarc.${domain}`),
    txt(`google._domainkey.${domain}`),
  ]);
  const spf = root.find((r) => r.toLowerCase().startsWith("v=spf1")) || null;
  const dmarcRec = dmarc.find((r) => r.toLowerCase().startsWith("v=dmarc1")) || null;
  const dkim = dkimGoogle.find((r) => r.includes("p=")) || null;
  return {
    domain,
    mx: { ok: mx.length > 0, value: mx.slice(0, 3).join(", ") || null },
    spf: {
      ok: !!spf && /include:_spf\.google\.com|include:spf\.protection\.outlook\.com|include:/i.test(spf),
      value: spf,
      hint: "Add TXT @ → v=spf1 include:_spf.google.com ~all",
    },
    dkim: { ok: !!dkim, value: dkim ? "google._domainkey found" : null, hint: "Google Admin → Apps → Gmail → Authenticate email → generate DKIM, add TXT google._domainkey" },
    dmarc: { ok: !!dmarcRec, value: dmarcRec, hint: "Add TXT _dmarc → v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com" },
  };
}
