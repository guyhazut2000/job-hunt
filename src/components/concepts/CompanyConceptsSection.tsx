import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { companySuggestions } from "@/lib/concepts/catalog";
import { companyConceptSlug, type ConceptStatus } from "@/lib/concepts/core";
import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/dictionaries";
import { conceptStrings } from "@/lib/i18n/concepts";
import { fmt } from "@/lib/i18n/learning";
import { StatusBadge } from "./ConceptBits";
import { SuggestionChips } from "./SuggestionChips";

/** "Concepts & culture" on a company page: the user's company concepts + suggested ones to explore. */
export async function CompanyConceptsSection({
  company,
  userId,
  locale,
}: {
  company: { id: string; name: string; slug: string };
  userId?: string;
  locale: Locale;
}) {
  const t = conceptStrings(locale);
  const mine = userId
    ? await db.concept.findMany({
        where: { userId, companyId: company.id },
        select: { id: true, name: true, slug: true, status: true },
        orderBy: { lastOpenedAt: "desc" },
        take: 30,
      })
    : [];
  const bySlug = new Map(mine.map((m) => [m.slug, m.id]));
  const suggestions = companySuggestions(company.slug)
    .map((name) => ({ name, existingId: bySlug.get(companyConceptSlug(company.slug, name)) ?? null }))
    .filter((s) => !s.existingId)
    .slice(0, 8);

  return (
    <section
      aria-labelledby="company-concepts"
      data-testid="company-concepts"
      className="border-rule flex min-w-0 flex-col gap-4 border-t-2 pt-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="company-concepts" className="font-heading text-xl font-bold">
          {t.companySectionTitle}
        </h2>
        <p className="text-muted-foreground flex items-start gap-1.5 text-sm leading-relaxed">
          <ShieldAlert className="text-caution mt-0.5 size-4 shrink-0" aria-hidden />
          {fmt(t.companySectionLead, { company: company.name })}
        </p>
      </div>
      {mine.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="kicker">{fmt(t.companyMine, { company: company.name })}</h3>
          <ul className="flex flex-wrap gap-2">
            {mine.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/learn/concepts/${c.id}`}
                  className="bg-card hover:bg-secondary inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold"
                >
                  <bdi dir="auto">{c.name}</bdi>
                  <StatusBadge status={c.status as ConceptStatus} t={t} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="kicker">{t.companyExplore}</h3>
          <SuggestionChips
            testId="company-concept-suggestions"
            signedIn={!!userId}
            items={suggestions.map((s) => ({
              name: s.name,
              kind: "COMPANY",
              companyId: company.id,
              source: `company:${company.slug}`,
            }))}
          />
          {!userId && (
            <p className="text-muted-foreground text-sm">
              <Link
                href={`/login?next=${encodeURIComponent(`/companies/${company.slug}`)}`}
                className="text-primary font-semibold hover:underline"
              >
                {t.companySignIn}
              </Link>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
