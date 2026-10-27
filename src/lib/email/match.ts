/** Fuzzy matching of extracted company/title against the user's Jobs and Companies. */

const COMPANY_NOISE =
  /\b(?:inc|incorporated|ltd|llc|plc|gmbh|corp|corporation|co|company|technologies|technology|tech|labs|group|holdings|israel|il|software|systems|בע"?מ|בעמ|ישראל)\b/g;

export function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u0591-\u05c7]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCompany(s: string): string {
  return normalize(s).replace(COMPANY_NOISE, " ").replace(/\s+/g, " ").trim();
}

function bigrams(s: string): string[] {
  const t = s.replace(/\s+/g, " ");
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

/** Sørensen–Dice on character bigrams (0..1). */
export function dice(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.length || !B.length) return 0;
  const counts = new Map<string, number>();
  for (const g of A) counts.set(g, (counts.get(g) ?? 0) + 1);
  let hit = 0;
  for (const g of B) {
    const c = counts.get(g) ?? 0;
    if (c > 0) {
      hit++;
      counts.set(g, c - 1);
    }
  }
  return (2 * hit) / (A.length + B.length);
}

export function companySimilarity(a: string, b: string): number {
  const x = normalizeCompany(a) || normalize(a);
  const y = normalizeCompany(b) || normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const compactX = x.replace(/\s/g, "");
  const compactY = y.replace(/\s/g, "");
  if (compactX === compactY) return 0.97;
  // "acme" vs "acme payments": whole-word containment
  const wx = ` ${x} `;
  const wy = ` ${y} `;
  if (wx.includes(wy) || wy.includes(wx)) return 0.9;
  return dice(compactX, compactY);
}

const TITLE_NOISE = /\b(?:position|role|job|opening|m\/f|f\/m|hybrid|remote|on ?site|full ?time|part ?time)\b/g;
const TITLE_SYNONYMS: [RegExp, string][] = [
  [/\bsr\b/g, "senior"],
  [/\bjr\b/g, "junior"],
  [/\beng\b/g, "engineer"],
  [/\bdev\b/g, "developer"],
  [/\bswe\b/g, "software engineer"],
  [/\bfe\b/g, "frontend"],
  [/\bfront end\b|\bfront-end\b/g, "frontend"],
  [/\bback end\b|\bback-end\b/g, "backend"],
  [/\bfull stack\b|\bfull-stack\b/g, "fullstack"],
];

export function normalizeTitle(s: string): string {
  let t = normalize(s.replace(/front-end|back-end|full-stack/gi, (m) => m.replace("-", "")));
  for (const [re, rep] of TITLE_SYNONYMS) t = t.replace(re, rep);
  return t.replace(TITLE_NOISE, " ").replace(/\s+/g, " ").trim();
}

/** Blend of token overlap and bigram similarity (0..1). */
export function titleSimilarity(a: string, b: string): number {
  const x = normalizeTitle(a);
  const y = normalizeTitle(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const tx = new Set(x.split(" "));
  const ty = new Set(y.split(" "));
  let inter = 0;
  for (const t of tx) if (ty.has(t)) inter++;
  const jaccard = inter / new Set([...tx, ...ty]).size;
  const contain = inter / Math.min(tx.size, ty.size);
  return Math.max(dice(x, y), 0.5 * jaccard + 0.5 * contain * 0.9);
}

export type CompanyLike = { id: string; name: string; slug?: string | null; website?: string | null };
export type JobLike = { id: string; title: string; companyId: string; isActive?: boolean };

export function hostLabel(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url.includes("://") ? url : `https://${url}`).hostname.replace(/^www\./, "");
    const parts = host.split(".");
    const tld2 = parts.length >= 3 && /^(co|com|org|net|ac)$/.test(parts[parts.length - 2]);
    return parts[parts.length - (tld2 ? 3 : 2)] ?? null;
  } catch {
    return null;
  }
}

export function bestCompany<T extends CompanyLike>(
  name: string | null,
  companies: T[],
  senderDomainLabel?: string | null,
): { company: T; score: number } | null {
  let best: { company: T; score: number } | null = null;
  for (const c of companies) {
    let s = 0;
    if (name)
      s = Math.max(companySimilarity(name, c.name), c.slug ? companySimilarity(name, c.slug.replace(/-/g, " ")) : 0);
    const label = hostLabel(c.website);
    if (label && senderDomainLabel && label === senderDomainLabel) s = Math.max(s, 0.95);
    if (label && name && normalizeCompany(name).replace(/\s/g, "") === label) s = Math.max(s, 0.95);
    if (!best || s > best.score) best = { company: c, score: s };
  }
  return best && best.score > 0 ? best : null;
}

export function bestJob<T extends JobLike>(title: string | null, jobs: T[]): { job: T; score: number } | null {
  if (!title) return null;
  let best: { job: T; score: number } | null = null;
  for (const j of jobs) {
    // Prefer active postings on ties.
    const s = titleSimilarity(title, j.title) + (j.isActive === false ? -0.01 : 0);
    if (!best || s > best.score) best = { job: j, score: s };
  }
  return best;
}
