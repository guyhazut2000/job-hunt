import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Building2, Map as MapIcon, ShieldAlert } from "lucide-react";
import { ConceptChat } from "@/components/concepts/ConceptChat";
import { ConceptManage } from "@/components/concepts/ConceptManage";
import { ConceptOverviewCard, OutboundLink } from "@/components/concepts/ConceptOverviewCard";
import { StatusBadge } from "@/components/concepts/ConceptBits";
import { SuggestionChips } from "@/components/concepts/SuggestionChips";
import { COMPANY_SOURCES, CONCEPT_DOCS, skillSuggestions } from "@/lib/concepts/catalog";
import {
  isCategory,
  splitConceptSlug,
  type ConceptAction,
  type ConceptKind,
  type ConceptStatus,
} from "@/lib/concepts/core";
import { loadOverview } from "@/lib/concepts/server";
import { db } from "@/lib/db";
import { communityLinks } from "@/lib/hiring/community";
import { getDictionary } from "@/lib/i18n";
import { conceptStrings } from "@/lib/i18n/concepts";
import { fmt } from "@/lib/i18n/learning";
import { GRAPH } from "@/lib/learning/graph";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  const c = await db.concept.findUnique({ where: { id }, select: { name: true } });
  return { title: c ? `${c.name} · Concepts` : "Concepts" };
}

export default async function ConceptPage({ params }: Params) {
  const user = await requireUser();
  const { id } = await params;
  const concept = await db.concept.findFirst({
    where: { id, userId: user.id },
    include: {
      company: { select: { id: true, name: true, slug: true } },
      parent: { select: { id: true, name: true } },
      children: { select: { id: true, name: true }, orderBy: { createdAt: "asc" }, take: 20 },
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
    },
  });
  if (!concept) notFound();
  await db.concept
    .update({ where: { id: concept.id }, data: { lastOpenedAt: new Date() }, select: { id: true } })
    .catch(() => null);
  const { locale } = await getDictionary();
  const t = conceptStrings(locale);
  const kind = concept.kind as ConceptKind;
  const ref = { slug: concept.slug, name: concept.name, kind, skill: concept.skill, company: concept.company };
  const [ov, mine] = await Promise.all([
    loadOverview(ref, locale),
    db.concept.findMany({ where: { userId: user.id }, select: { id: true, slug: true } }),
  ]);
  const existing = Object.fromEntries(mine.map((m) => [m.slug, m.id]));
  const node = concept.skill ? GRAPH.byId.get(concept.skill) : undefined;
  const docs = CONCEPT_DOCS[splitConceptSlug(concept.slug).base];
  const isCompany = kind === "COMPANY" && concept.company;
  const official = isCompany ? (COMPANY_SOURCES[concept.company!.slug] ?? []) : [];
  const community = isCompany ? communityLinks(concept.company!.name) : [];
  const around = node
    ? skillSuggestions(node.id, Object.keys(existing))
        .filter((n) => n !== concept.name)
        .slice(0, 5)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <header className="motion-safe:animate-rise flex flex-col gap-3">
        <Link
          href="/learn/concepts"
          className="text-primary inline-flex min-h-10 w-fit items-center gap-1 text-sm font-semibold hover:underline"
        >
          <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
          {t.back}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 dir="auto" className="text-title leading-tight font-black break-words">
            {concept.name}
          </h1>
          <StatusBadge status={concept.status as ConceptStatus} t={t} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {concept.company && (
            <Link
              href={`/companies/${concept.company.slug}`}
              className="text-foreground/80 inline-flex min-h-10 items-center gap-1.5 font-semibold hover:underline"
            >
              <Building2 className="size-4" aria-hidden />
              {concept.company.name}
            </Link>
          )}
          {concept.category && isCategory(concept.category) && (
            <span className="bg-secondary rounded-full px-2.5 py-0.5 text-xs font-semibold">
              {t.category[concept.category]}
            </span>
          )}
          {node && (
            <Link
              href={`/learn/${node.id}`}
              className="text-primary inline-flex min-h-10 items-center gap-1.5 font-semibold hover:underline"
              data-testid="concept-roadmap-link"
            >
              <MapIcon className="size-4" aria-hidden />
              {t.roadmapLink}: {node.label}
            </Link>
          )}
          {docs && <OutboundLink href={docs.url} label={`${t.docsLink}: ${docs.label}`} />}
          {concept.parent && (
            <span className="text-muted-foreground inline-flex items-center gap-1">
              {t.openedFrom}{" "}
              <Link
                href={`/learn/concepts/${concept.parent.id}`}
                className="text-primary font-semibold hover:underline"
                dir="auto"
              >
                {concept.parent.name}
              </Link>
            </span>
          )}
        </div>
        {isCompany && (
          <p
            className="bg-caution-soft/50 flex items-start gap-2 rounded-lg p-3 text-sm leading-relaxed"
            data-testid="company-disclaimer"
          >
            <ShieldAlert className="text-caution mt-0.5 size-4 shrink-0" aria-hidden />
            {t.companyDisclaimer}
          </p>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <ConceptOverviewCard
            conceptId={concept.id}
            init={ov}
            t={t}
            company={concept.company ? { id: concept.company.id, slug: concept.company.slug } : null}
            existing={existing}
          />
          <ConceptChat
            id={concept.id}
            refreshOnReply={concept.status === "NEW"}
            t={t}
            locale={locale}
            initial={concept.messages.map((m) => ({
              id: m.id,
              role: m.role === "user" ? "user" : "assistant",
              action: m.action as ConceptAction,
              content: m.content,
              source: m.source,
              createdAt: m.createdAt.toISOString(),
            }))}
          />
        </div>
        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <ConceptManage
            key={concept.status}
            id={concept.id}
            t={t}
            init={{
              status: concept.status as ConceptStatus,
              confidence: concept.confidence,
              notes: concept.notes ?? "",
              tags: concept.tags,
              category: isCategory(concept.category) ? concept.category : null,
            }}
          />
          {official.length > 0 && (
            <section className="bg-card flex flex-col gap-1 rounded-2xl border p-4" data-testid="official-links">
              <h2 className="kicker mb-1">{t.officialLinks}</h2>
              {official.map((l) => (
                <OutboundLink key={l.url} href={l.url} label={l.label} />
              ))}
            </section>
          )}
          {community.length > 0 && (
            <section className="bg-card flex flex-col gap-1 rounded-2xl border p-4">
              <h2 className="kicker mb-1">{t.communityLinks}</h2>
              {community.map((l) => (
                <OutboundLink key={l.id} href={l.url} label={l.site} badge={t.externalBadge} />
              ))}
            </section>
          )}
          {concept.children.length > 0 && (
            <section className="bg-card flex flex-col gap-2 rounded-2xl border p-4">
              <h2 className="kicker">{t.childrenTitle}</h2>
              <SuggestionChips items={concept.children.map((c) => ({ name: c.name, existingId: c.id }))} />
            </section>
          )}
          {node && around.length > 0 && (
            <section className="bg-card flex flex-col gap-2 rounded-2xl border p-4">
              <h2 className="kicker">{fmt(t.contextualFrom, { skill: node.label })}</h2>
              <SuggestionChips
                items={around.map((name) => ({
                  name,
                  skill: node.id,
                  parentId: concept.id,
                  source: `skill:${node.id}`,
                }))}
              />
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
