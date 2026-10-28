import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { LinkedinCompanyIcon } from "@/components/LinkedinCompanyLink";
import { TruncatedText } from "@/components/TruncatedText";
import { Badge } from "@/components/ui/badge";
import {
  careersLink,
  type CompanyFilter,
  isManualCompany,
  isSyncFailing,
  matchesFilter,
  parseCompanyFilter,
} from "@/lib/companies/status";
import { db } from "@/lib/db";
import { groupByLetter, HEBREW, LATIN, letterAnchor, OTHER } from "@/lib/alpha";
import { getDictionary } from "@/lib/i18n";
import { linkedinStrings } from "@/lib/i18n/linkedin";
import { BackToTop } from "@/components/BackToTop";
import { cn } from "@/lib/utils";
import { companyMatchesTerms } from "@/lib/companies/search";
import { highlightTerms, MAX_QUERY_LENGTH, parseSearchQuery } from "@/lib/search/query";
import { fillQ, searchStrings } from "@/lib/i18n/search";
import { SearchBox } from "@/components/SearchBox";

export const dynamic = "force-dynamic";
export const metadata = { title: "Companies" };

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ t, locale }, sp] = await Promise.all([getDictionary(), searchParams]);
  const li = linkedinStrings(locale);
  const filter = parseCompanyFilter(sp.sync);
  const ss = searchStrings(locale);
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, MAX_QUERY_LENGTH) || undefined;
  const terms = parseSearchQuery(q);
  const marks = highlightTerms(terms);
  const everything = await db.company.findMany({
    include: { _count: { select: { jobs: { where: { isActive: true } } } } },
    orderBy: { name: "asc" },
  });
  const hiring = everything.filter((c) => c._count.jobs > 0).length;
  // The search narrows every tab (counts included); A/B/C groups left empty simply disappear.
  const all = everything.filter((c) => companyMatchesTerms(c, terms));
  const tabHref = (key: CompanyFilter) => {
    const p = new URLSearchParams();
    if (key !== "all") p.set("sync", key);
    if (q) p.set("q", q);
    const qs = p.toString();
    return qs ? `/companies?${qs}` : "/companies";
  };
  const counts: Record<CompanyFilter, number> = {
    all: all.length,
    auto: all.filter((c) => matchesFilter(c, "auto")).length,
    manual: all.filter((c) => matchesFilter(c, "manual")).length,
  };
  const filters: { key: CompanyFilter; label: string }[] = [
    { key: "all", label: t.companies.filterAll },
    { key: "auto", label: t.companies.filterAuto },
    { key: "manual", label: t.companies.filterManual },
  ];
  const companies = all.filter((c) => matchesFilter(c, filter));
  const groups = groupByLetter(companies, (c) => c.name);
  const present = new Set(groups.map((g) => g.letter));
  // Full Latin row (missing letters shown disabled); Hebrew letters and "#" only when used.
  const jump = [
    { key: "latin", dir: "ltr" as const, letters: LATIN },
    { key: "hebrew", dir: "rtl" as const, letters: HEBREW.filter((l) => present.has(l)) },
    { key: "other", dir: "ltr" as const, letters: present.has(OTHER) ? [OTHER] : [] },
  ].filter((g) => g.letters.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="rule-double flex flex-wrap items-end justify-between gap-3 pb-4">
        <div>
          <p className="kicker">{t.ui.kicker}</p>
          <h1 className="text-title mt-1 font-black">{t.companies.title}</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          <span className="text-foreground font-mono font-medium">{hiring}</span> {t.ui.hiringNow}
        </p>
      </header>

      <SearchBox s={ss.companies} resetParams={[]} testId="companies-search" className="-mt-2" />

      <nav aria-label={t.companies.filter} className="-mt-2">
        <ul className="no-scrollbar flex gap-2 overflow-x-auto" data-company-filter>
          {filters.map((f) => {
            const active = f.key === filter;
            return (
              <li key={f.key} className="shrink-0">
                <Link
                  href={tabHref(f.key)}
                  aria-current={active ? "page" : undefined}
                  scroll={false}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-foreground hover:bg-muted",
                  )}
                >
                  {f.label}
                  <span className={cn("font-mono text-xs", active ? "opacity-80" : "text-muted-foreground")}>
                    {counts[f.key]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {q && (
        <p className="text-muted-foreground -mt-2 text-sm" aria-live="polite" data-testid="companies-count">
          <span className="text-foreground font-mono font-medium">{companies.length}</span> {ss.companiesFound}{" "}
          <span dir="auto">{fillQ(ss.resultsFor, q)}</span>
        </p>
      )}

      {groups.length === 0 &&
        (q ? (
          <div
            className="bg-card text-muted-foreground flex flex-col items-center gap-3 rounded-lg border p-8 text-center"
            data-testid="companies-empty"
          >
            <p className="text-foreground text-lg font-bold break-words" dir="auto">
              {fillQ(ss.noCompaniesFor, q)}
            </p>
            <Link
              href={filter === "all" ? "/companies" : `/companies?sync=${filter}`}
              className="text-primary inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline"
            >
              {ss.clearSearch}
            </Link>
          </div>
        ) : (
          <p className="text-muted-foreground">{t.companies.noMatches}</p>
        ))}

      {groups.length > 1 && (
        <nav
          aria-label={t.companies.jumpTo}
          className="bg-background/92 sticky top-(--header-h) z-30 -mx-4 border-b px-4 py-2 backdrop-blur-md md:-mx-6 md:px-6"
        >
          {/* LTR track so the bar opens at "A" (sections run Latin → Hebrew → #) */}
          <ul dir="ltr" className="no-scrollbar flex items-center gap-x-3 overflow-x-auto overscroll-x-contain">
            {jump.map((g) => (
              <li key={g.key} className="shrink-0">
                <ul dir={g.dir} className="flex items-center">
                  {g.letters.map((l) => {
                    const label = l === OTHER ? t.companies.other : l;
                    const cls =
                      "grid h-9 min-w-8 place-items-center rounded-md px-1 font-mono text-sm font-medium md:h-8 md:min-w-7";
                    return (
                      <li key={l}>
                        {present.has(l) ? (
                          <a
                            href={`#${letterAnchor(l)}`}
                            aria-label={`${t.companies.jumpTo}: ${label}`}
                            className={cn(cls, "text-foreground hover:bg-muted focus-visible:bg-muted")}
                          >
                            {l}
                          </a>
                        ) : (
                          <span
                            aria-disabled="true"
                            title={`${t.companies.noneFor} ${label}`}
                            className={cn(cls, "text-muted-foreground/45 cursor-default")}
                          >
                            {l}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="flex flex-col gap-8">
        {groups.map((g) => {
          const id = letterAnchor(g.letter);
          return (
            <section
              key={g.letter}
              id={id}
              aria-labelledby={`${id}-h`}
              className="scroll-mt-[calc(var(--header-h)+4rem)]"
            >
              <div className="border-rule mb-3 flex items-baseline gap-3 border-b-2 pb-1.5">
                <h2 id={`${id}-h`} className="font-heading text-3xl leading-none font-black">
                  {g.letter === OTHER ? <span aria-label={t.companies.other}>#</span> : g.letter}
                </h2>
                <span className="text-muted-foreground font-mono text-xs">{g.items.length}</span>
              </div>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
                {g.items.map((c) => {
                  const meta = [c.industry, c.hqLocation].filter(Boolean).join(" · ");
                  const manual = isManualCompany(c);
                  const failing = isSyncFailing(c);
                  const careers = manual || failing ? careersLink(c) : null;
                  return (
                    <li
                      key={c.id}
                      data-sync={manual ? "manual" : "auto"}
                      className="bg-card flex min-w-0 flex-col overflow-hidden rounded-lg border"
                    >
                      <div className="flex min-w-0 flex-1">
                        <Link
                          href={`/companies/${c.slug}`}
                          className="group hover:bg-muted/60 flex h-full min-h-20 min-w-0 flex-1 items-center gap-4 px-4 py-4 transition-colors"
                        >
                          <span
                            aria-hidden
                            className="bg-foreground text-background grid size-11 shrink-0 place-items-center rounded-md font-mono text-lg font-medium uppercase"
                          >
                            {g.letter === OTHER ? c.name.trim()[0] : g.letter}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <TruncatedText
                              text={c.name}
                              highlight={marks}
                              lines={2}
                              className="font-heading group-hover:text-primary text-lg leading-tight font-bold"
                            />
                            {meta && (
                              <TruncatedText
                                text={meta}
                                highlight={marks}
                                side="bottom"
                                className="text-muted-foreground text-sm"
                              />
                            )}
                            {/* Under the name, not beside it: a side badge squeezed names until single words split. */}
                            {manual && (
                              <Badge
                                variant="outline"
                                title={t.companies.manualBadgeHint}
                                className="border-primary/50 text-primary mt-1 self-start"
                              >
                                {t.companies.manualBadge}
                              </Badge>
                            )}
                          </span>
                          {!manual && (
                            <span className="flex shrink-0 flex-col items-end gap-1 text-end">
                              <span
                                className={
                                  c._count.jobs > 0
                                    ? "text-fit font-mono text-xl leading-none font-medium"
                                    : "text-muted-foreground font-mono text-xl leading-none"
                                }
                              >
                                {c._count.jobs}
                              </span>
                              <span className="text-muted-foreground text-[0.7rem]">{t.companies.openRoles}</span>
                              {failing && (
                                <Badge variant="destructive" className="text-[0.65rem]">
                                  {t.companies.failingBadge}
                                </Badge>
                              )}
                            </span>
                          )}
                        </Link>
                        <LinkedinCompanyIcon company={c} s={li} />
                      </div>
                      {careers && (
                        <a
                          href={careers}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-careers-link
                          aria-label={`${t.companies.careersSite}: ${c.name}`}
                          className="text-primary hover:bg-muted/60 inline-flex min-h-11 items-center gap-1.5 border-t px-4 text-sm font-semibold"
                        >
                          {t.companies.careersSite}
                          <ExternalLink className="size-3.5" aria-hidden />
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <BackToTop label={t.ui.backToTop} />
    </div>
  );
}
