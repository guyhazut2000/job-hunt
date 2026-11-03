import { db } from "@/lib/db";
import { guardedLLM } from "@/lib/ai";
import { AiLimitError } from "@/lib/ai/errors";
import { readProfessional } from "@/lib/profile/load";
import { bestCompany, normalizeCompany } from "@/lib/email/match";
import { cleanCompanyName } from "@/lib/outreach/links";
import { aiMessageSchema, messagePrompt, templateMessage, validateAiMessage } from "./message";
import type { ReferralFacts, ReferralLang } from "./message";

export const COMPANY_MATCH_MIN = 0.85;

/** Match typed/imported company names to Company rows (fuzzy, conservative). */
export async function matchCompanies(names: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const uniq = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (!uniq.length) return out;
  const companies = await db.company.findMany({ select: { id: true, name: true, slug: true, website: true } });
  for (const n of uniq) {
    const hit = bestCompany(cleanCompanyName(n), companies);
    if (hit && hit.score >= COMPANY_MATCH_MIN) out.set(n, hit.company.id);
  }
  return out;
}

export interface InsiderRef {
  id: string;
  name: string;
}

/**
 * "יש לך מכר בפנים": the user's insider contacts per companyId. Contacts without a matched Company
 * are matched by normalized name against the given companies.
 */
export async function insidersByCompany(
  userId: string | null | undefined,
  companies: Array<{ id: string; name: string }>,
): Promise<Map<string, InsiderRef[]>> {
  const out = new Map<string, InsiderRef[]>();
  if (!userId || !companies.length) return out;
  const ids = companies.map((c) => c.id);
  const rows = await db.contact.findMany({
    where: { userId, insider: true, OR: [{ companyId: { in: ids } }, { companyId: null, companyName: { not: null } }] },
    select: { id: true, name: true, companyId: true, companyName: true },
    take: 1000,
  });
  const byNorm = new Map(companies.map((c) => [normalizeCompany(c.name), c.id]));
  for (const r of rows) {
    const cid = r.companyId ?? (r.companyName ? byNorm.get(normalizeCompany(cleanCompanyName(r.companyName))) : undefined);
    if (!cid || !ids.includes(cid)) continue;
    const list = out.get(cid) ?? [];
    list.push({ id: r.id, name: r.name });
    out.set(cid, list);
  }
  return out;
}

const firstSentence = (s: string | null | undefined, max = 200): string | null => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const cut = t.split(/(?<=[.!?])\s/)[0] ?? t;
  return cut.length > max ? null : cut;
};

export async function referralFacts(
  userId: string,
  contact: { name: string; relationship: string | null; companyName: string | null; company: { name: string } | null },
  target: { title: string | null; company: string | null; url: string | null; techStack: string[] },
): Promise<ReferralFacts> {
  const [profile, user] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);
  const pro = readProfessional(profile);
  const wanted = new Set(target.techStack.map((s) => s.toLowerCase()));
  const skills = pro.skillItems.map((s) => s.name).filter((n) => wanted.has(n.toLowerCase()));
  return {
    contactName: contact.name,
    relationship: contact.relationship?.trim() || null,
    company: target.company || contact.company?.name || contact.companyName || "",
    jobTitle: target.title,
    jobUrl: target.url && /^https:\/\//.test(target.url) && !/linkedin\.com/i.test(target.url) ? target.url : null,
    senderName: user?.name || null,
    highlight: firstSentence(pro.headline) ?? firstSentence(pro.summary),
    skills: skills.slice(0, 3),
  };
}

export async function generateReferralMessage(
  userId: string,
  facts: ReferralFacts,
  lang: ReferralLang,
): Promise<{ body: string; source: "ai" | "template" | "limited" }> {
  const template = templateMessage(facts, lang);
  const llm = await guardedLLM("referral_request", userId);
  if (llm.name === "mock") return { body: template, source: "template" };
  try {
    const raw = await llm.complete(messagePrompt(facts, lang), { schema: aiMessageSchema, maxTokens: 500 });
    const ok = validateAiMessage(JSON.parse(raw), facts);
    return ok ? { body: ok, source: "ai" } : { body: template, source: "template" };
  } catch (e) {
    if (e instanceof AiLimitError) return { body: template, source: "limited" };
    return { body: template, source: "template" };
  }
}
