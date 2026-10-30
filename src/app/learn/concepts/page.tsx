import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { AddConceptForm } from "@/components/concepts/AddConceptForm";
import { ConceptList } from "@/components/concepts/ConceptList";
import { SuggestionChips } from "@/components/concepts/SuggestionChips";
import { STARTER_SUGGESTIONS, skillSuggestions } from "@/lib/concepts/catalog";
import {
  CONCEPT_CATEGORIES,
  conceptSlug,
  type ConceptKind,
  type ConceptListItem,
  type ConceptStatus,
} from "@/lib/concepts/core";
import { summariesFor } from "@/lib/concepts/store";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { conceptStrings } from "@/lib/i18n/concepts";
import { fmt, learningStrings } from "@/lib/i18n/learning";
import { GRAPH } from "@/lib/learning/graph";
import { getProgress } from "@/lib/learning/server";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Concepts" };

export default async function ConceptsPage() {
  const user = await requireUser("/learn/concepts");
  const { locale } = await getDictionary();
  const t = conceptStrings(locale);
  const s = learningStrings(locale);
  const [rows, companies, progress] = await Promise.all([
    db.concept.findMany({
      where: { userId: user.id },
      orderBy: { lastOpenedAt: "desc" },
      take: 500,
      select: {
        id: true,
        name: true,
        slug: true,
        kind: true,
        status: true,
        confidence: true,
        category: true,
        tags: true,
        updatedAt: true,
        company: { select: { name: true } },
        _count: { select: { messages: true } },
      },
    }),
    db.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
    getProgress(user.id),
  ]);
  const summaries = await summariesFor(
    rows.map((r) => r.slug),
    locale,
  );
  const items: ConceptListItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    kind: r.kind as ConceptKind,
    status: r.status as ConceptStatus,
    confidence: r.confidence,
    category: r.category,
    tags: r.tags,
    companyName: r.company?.name ?? null,
    summary: summaries.get(r.slug) ?? null,
    messages: r._count.messages,
    updatedAt: r.updatedAt.toISOString(),
  }));
  const have = new Set(rows.map((r) => r.slug));
  const idBySlug = new Map(rows.map((r) => [r.slug, r.id]));

  // Contextual: concepts around the skills the user is learning now (max 3 skills).
  const learningSkills = progress
    .filter((p) => p.status === "LEARNING" && GRAPH.byId.has(p.skill))
    .slice(0, 3)
    .map((p) => GRAPH.byId.get(p.skill)!);
  const contextual = learningSkills
    .map((n) => ({ n, names: skillSuggestions(n.id, have).slice(0, 5) }))
    .filter((x) => x.names.length > 0);

  const starters = CONCEPT_CATEGORIES.map((c) => ({
    c,
    names: STARTER_SUGGESTIONS.filter((x) => x.category === c).map((x) => x.name),
  })).filter((g) => g.names.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <header className="motion-safe:animate-rise flex flex-col gap-2">
        <Link
          href="/learn"
          className="text-primary inline-flex min-h-10 w-fit items-center gap-1 text-sm font-semibold hover:underline"
        >
          <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
          {s.nav}
        </Link>
        <h1 className="text-title leading-tight font-black">{t.title}</h1>
        <p className="text-foreground/80 max-w-[65ch] leading-relaxed">{t.lead}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <AddConceptForm t={t} companies={companies} />
          <section aria-labelledby="mine" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="mine" className="text-2xl font-bold">
                {t.mineTitle}
              </h2>
              {items.length > 0 && (
                <span className="text-muted-foreground text-sm">{fmt(t.countLine, { n: items.length })}</span>
              )}
            </div>
            {items.length === 0 ? (
              <div
                className="bg-card flex flex-col items-start gap-2 rounded-xl border border-dashed p-6"
                data-testid="concepts-empty"
              >
                <Sparkles className="text-primary size-6" aria-hidden />
                <p className="font-bold">{t.emptyTitle}</p>
                <p className="text-foreground/75 text-sm">{t.emptyLead}</p>
              </div>
            ) : (
              <ConceptList items={items} t={t} />
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
          {contextual.length > 0 && (
            <section aria-labelledby="ctx" className="bg-accent/40 flex flex-col gap-3 rounded-2xl border p-4">
              <h2 id="ctx" className="kicker">
                {t.contextualTitle}
              </h2>
              {contextual.map(({ n, names }) => (
                <div key={n.id} className="flex flex-col gap-2">
                  <p className="text-sm font-semibold">{fmt(t.contextualFrom, { skill: n.label })}</p>
                  <SuggestionChips items={names.map((name) => ({ name, skill: n.id, source: `skill:${n.id}` }))} />
                </div>
              ))}
            </section>
          )}
          <section
            aria-labelledby="starters"
            className="bg-card flex flex-col gap-3 rounded-2xl border p-4"
            data-testid="concept-suggestions"
          >
            <h2 id="starters" className="kicker">
              {t.suggestionsTitle}
            </h2>
            {starters.map(({ c, names }) => (
              <div key={c} className="flex flex-col gap-1.5">
                <p className="text-muted-foreground text-xs font-semibold">{t.category[c]}</p>
                <SuggestionChips
                  items={names.map((name) => ({
                    name,
                    category: c,
                    source: "suggested",
                    existingId: idBySlug.get(conceptSlug(name)) ?? null,
                  }))}
                />
              </div>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}
