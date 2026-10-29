/** Concept persistence helpers (server; docs/concepts.md). */
import { db } from "@/lib/db";
import { CONCEPT_SKILL, CURATED } from "./catalog";
import { cleanName, companyConceptSlug, conceptSlug, isCategory, type ConceptCategory, type ConceptKind } from "./core";
import { conceptCategoryForSkill, skillForConcept } from "./fallback";

export interface NewConcept {
  name: string;
  kind: ConceptKind;
  companyId?: string | null;
  parentId?: string | null;
  skill?: string | null;
  source?: string | null;
  category?: string | null;
}

export type EnsureResult = { ok: true; id: string; created: boolean } | { ok: false; error: "name" | "company" };

/** Find the user's concept by canonical slug, or create it. Idempotent, so double clicks / related chips never duplicate. */
export async function ensureConcept(userId: string, input: NewConcept): Promise<EnsureResult> {
  const name = cleanName(input.name);
  if (name.length < 1 || !conceptSlug(name)) return { ok: false, error: "name" };
  let company: { id: string; slug: string } | null = null;
  if (input.kind === "COMPANY") {
    if (!input.companyId) return { ok: false, error: "company" };
    company = await db.company.findUnique({ where: { id: input.companyId }, select: { id: true, slug: true } });
    if (!company) return { ok: false, error: "company" };
  }
  const slug = company ? companyConceptSlug(company.slug, name) : conceptSlug(name);
  const existing = await db.concept.findUnique({ where: { userId_slug: { userId, slug } }, select: { id: true } });
  if (existing) {
    await db.concept.update({ where: { id: existing.id }, data: { lastOpenedAt: new Date() } });
    return { ok: true, id: existing.id, created: false };
  }
  const node = input.kind === "TECH" ? skillForConcept(name) : undefined;
  const skill = input.skill ?? CONCEPT_SKILL[slug] ?? node?.id ?? null;
  const curatedCat = CURATED[slug]?.en.category;
  const category: ConceptCategory | null =
    input.kind === "COMPANY"
      ? "company"
      : isCategory(input.category)
        ? input.category
        : (curatedCat ?? (node ? conceptCategoryForSkill(node) : null));
  let parentId: string | null = null;
  if (input.parentId) {
    const p = await db.concept.findFirst({ where: { id: input.parentId, userId }, select: { id: true } });
    parentId = p?.id ?? null;
  }
  try {
    const row = await db.concept.create({
      data: {
        userId,
        slug,
        name,
        kind: input.kind,
        companyId: company?.id ?? null,
        skill,
        category,
        parentId,
        source: input.source?.slice(0, 40) ?? "manual",
      },
      select: { id: true },
    });
    return { ok: true, id: row.id, created: true };
  } catch {
    // Unique race (two tabs): return the winner.
    const again = await db.concept.findUnique({ where: { userId_slug: { userId, slug } }, select: { id: true } });
    if (again) return { ok: true, id: again.id, created: false };
    throw new Error("concept create failed");
  }
}

/** Short summary per slug for list cards: stored shared overview → curated → none. */
export async function summariesFor(slugs: string[], locale: "he" | "en"): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (slugs.length === 0) return out;
  const rows = await db.conceptOverview.findMany({
    where: { key: { in: slugs }, locale },
    select: { key: true, content: true },
  });
  for (const r of rows) {
    const s = (r.content as { summary?: unknown } | null)?.summary;
    if (typeof s === "string") out.set(r.key, s.slice(0, 220));
  }
  for (const slug of slugs)
    if (!out.has(slug) && CURATED[slug]) out.set(slug, CURATED[slug][locale].summary.slice(0, 220));
  return out;
}
