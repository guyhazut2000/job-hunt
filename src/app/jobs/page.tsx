import type { Metadata } from "next";
import type { Company, Job } from "@prisma/client";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { auth } from "@/auth";
import { FilterSheet } from "@/components/FilterSheet";
import { JobCard, JobList } from "@/components/JobCard";
import { JobFilterForm, type Facets } from "@/components/JobFilters";
import { SortMenu } from "@/components/SortMenu";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { BackToTop } from "@/components/BackToTop";
import { fill, jobSearchStrings } from "@/lib/i18n/job-search";
import { hasScorableProfile, scoreMatch, toCandidate } from "@/lib/profile/score";
import {
  activeFilterCount,
  clearedFilters,
  compareJobs,
  effectiveSort,
  filtersToQuery,
  filtersToWhere,
  fitCompanies,
  needsScoring,
  PAGE_SIZE,
  parseFilters,
  SORTS,
  sortToOrderBy,
  withoutValue,
  type JobFilters,
} from "@/lib/jobs/filters";
import { splitLocations } from "@/lib/jobs/facets";
import { matchCompanies, rankJob } from "@/lib/jobs/search";
import { highlightTerms, parseSearchQuery } from "@/lib/search/query";
import { fillQ, searchStrings } from "@/lib/i18n/search";
import { SearchBox, type SearchSuggestion } from "@/components/SearchBox";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Jobs" };

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ t, locale }, session, params] = await Promise.all([getDictionary(), auth(), searchParams]);
  const s = jobSearchStrings(locale);
  const ss = searchStrings(locale);
  const userId = session?.user?.id;
  const filters = parseFilters(params);
  const profile = userId ? await db.profile.findUnique({ where: { userId } }) : null;
  const candidate = hasScorableProfile(profile) ? toCandidate(profile) : null;
  const hasProfile = !!candidate;
  const sort = effectiveSort(filters, hasProfile);
  const terms = parseSearchQuery(filters.q);
  const href = (f: JobFilters) => `/jobs${filtersToQuery(f)}`;

  // Facet counts are over all open roles (cheap: a handful of grouped queries on ~600 rows).
  const active = { isActive: true } as const;
  const [fnG, levelG, typeG, modeG, companyG, locRows, techRows] = await Promise.all([
    db.job.groupBy({ by: ["jobFunction"], where: active, _count: true }),
    db.job.groupBy({ by: ["level"], where: active, _count: true }),
    db.job.groupBy({ by: ["employmentType"], where: active, _count: true }),
    db.job.groupBy({ by: ["workMode"], where: active, _count: true }),
    db.job.groupBy({ by: ["companyId"], where: active, _count: true }),
    db.job.findMany({ where: active, select: { location: true } }),
    db.$queryRaw<{ tag: string; n: bigint }[]>`
      SELECT tag, count(*) AS n FROM (SELECT unnest("techStack") AS tag FROM "Job" WHERE "isActive") t
      GROUP BY tag ORDER BY n DESC LIMIT 200`,
  ]);
  const companyRows = await db.company.findMany({
    where: { id: { in: companyG.map((c) => c.companyId) } },
    select: { id: true, slug: true, name: true, website: true },
  });
  // Company names/domains are resolved to ids up front so the text search stays index-friendly.
  const companyMatches = terms.length ? matchCompanies(terms, companyRows) : undefined;
  const where = filtersToWhere(filters, { userId, companyMatches });
  const marks = highlightTerms(terms);
  const count = <K extends string>(rows: ({ _count: number } & Record<K, string>)[], k: K) =>
    Object.fromEntries(rows.map((r) => [r[k], r._count]));
  const companyCount = count(companyG, "companyId");
  const facets: Facets = {
    fn: count(fnG, "jobFunction"),
    level: count(levelG, "level"),
    type: count(typeG, "employmentType"),
    workMode: count(modeG, "workMode"),
    cities: splitLocations(locRows.map((r) => r.location)).slice(0, 15),
    companies: companyRows
      .map((c) => ({ slug: c.slug, name: c.name, count: companyCount[c.id] ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name, "en")),
  };

  // Scoring all open roles (no descriptions) powers "best match", the match threshold and "companies that fit me".
  const scoredAll: { job: Job & { company: Company }; score: number }[] = candidate
    ? (await db.job.findMany({ where: active, include: { company: true }, omit: { description: true } })).map((j) => ({
        job: { ...j, description: "" },
        score: scoreMatch(candidate, j).score,
      }))
    : [];
  const fits = fitCompanies(scoredAll);
  const fitIds = new Set(fits.map((c) => c.companyId));

  let total: number;
  let rows: { job: Job & { company: Company }; score?: number }[];
  async function fetchPage() {
    return db.job.findMany({
      where,
      include: { company: true },
      orderBy: sortToOrderBy(sort),
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });
  }
  if (needsScoring(filters, hasProfile)) {
    const ids = new Set((await db.job.findMany({ where, select: { id: true } })).map((j) => j.id));
    const matching = scoredAll
      .filter((x) => ids.has(x.job.id))
      .map((x) => (terms.length ? { ...x, rank: rankJob(x.job, terms) } : x))
      .filter((x) => filters.minMatch === undefined || x.score >= filters.minMatch)
      .filter((x) => !filters.fit || fitIds.has(x.job.companyId))
      .sort(compareJobs(sort));
    total = matching.length;
    rows = matching.slice((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE);
  } else if (sort === "relevance") {
    // Rank every match on light columns (no descriptions), then load only the visible page.
    const light = await db.job.findMany({
      where,
      select: {
        id: true,
        title: true,
        location: true,
        department: true,
        techStack: true,
        postedAt: true,
        company: { select: { name: true } },
      },
    });
    const ranked = light
      .map((job) => ({ job, score: 0, rank: rankJob(job, terms) }))
      .sort(compareJobs("relevance"))
      .slice((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE)
      .map((x) => x.job.id);
    total = light.length;
    const full = await db.job.findMany({ where: { id: { in: ranked } }, include: { company: true } });
    const byId = new Map(full.map((j) => [j.id, j]));
    rows = ranked
      .map((id) => byId.get(id))
      .filter((j): j is Job & { company: Company } => !!j)
      .map((job) => ({ job, score: candidate ? scoreMatch(candidate, job).score : undefined }));
  } else {
    const [n, jobs] = await Promise.all([db.job.count({ where }), fetchPage()]);
    total = n;
    rows = jobs.map((job) => ({ job, score: candidate ? scoreMatch(candidate, job).score : undefined }));
  }
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const welcome = params.welcome === "1";
  const nFilters = activeFilterCount(filters);

  // Strip of the best matches, only when the list itself isn't already match-ordered.
  const top =
    candidate && sort !== "match" && filters.page === 1 && nFilters === 0
      ? [...scoredAll]
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .filter((x) => x.score >= 40)
      : [];
  const fitStrip =
    candidate && filters.page === 1 && !filters.fit && filters.company.length === 0
      ? fits.slice(0, 8).map((f) => ({ ...f, company: companyRows.find((c) => c.id === f.companyId)! }))
      : [];

  // One chip per active value.
  const chips: { key: string; label: string; href: string }[] = [];
  const chip = (k: keyof JobFilters, label: string, value?: string) =>
    chips.push({ key: `${k}:${value ?? ""}`, label, href: href(withoutValue(filters, k, value)) });
  if (filters.q) chip("q", `“${filters.q}”`);
  if (filters.posted) chip("posted", s.postedChip[filters.posted]);
  if (filters.minMatch) chip("minMatch", fill(s.minMatchChip, filters.minMatch));
  if (filters.fit) chip("fit", s.fitChip);
  for (const h of filters.hide) chip("hide", s.hideChip[h], h);
  for (const v of filters.fn) chip("fn", s.functions[v as keyof typeof s.functions] ?? v, v);
  if (filters.role) chip("role", t.roles[filters.role]);
  if (filters.seniority) chip("seniority", t.seniority[filters.seniority]);
  for (const v of filters.level) chip("level", s.levels[v], v);
  for (const v of filters.city) chip("city", v, v);
  for (const v of filters.workMode) chip("workMode", t.workMode[v], v);
  for (const v of filters.company) chip("company", companyRows.find((c) => c.slug === v)?.name ?? v, v);
  for (const v of filters.type) chip("type", s.types[v], v);
  if (filters.tech) chip("tech", filters.tech);
  const clearHref = href(clearedFilters(filters));

  const sortOptions = SORTS.filter((k) => k !== "relevance" || terms.length > 0).map((k) => ({
    key: k,
    label: s.sorts[k],
    href: href({ ...filters, sort: k, page: 1 }),
    disabled: k === "match" && !hasProfile,
  }));

  const formProps = { t, s, filters, facets, hasProfile, signedIn: !!userId, clearHref };
  const suggestions: SearchSuggestion[] = [
    ...facets.companies.map((c) => ({ kind: "company" as const, label: c.name, params: { company: c.slug } })),
    ...techRows.map((r) => ({ kind: "skill" as const, label: r.tag, params: { tech: r.tag } })),
  ];
  const clearSearchHref = href({ ...filters, q: undefined, page: 1 });

  return (
    <div className="grid gap-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain pe-1">
          <h2 className="kicker mb-4">{t.ui.filters}</h2>
          <JobFilterForm {...formProps} idPrefix="d" />
        </div>
      </aside>
      <section className="flex min-w-0 flex-col gap-5" aria-labelledby="jobs-title">
        <header className="rule-double flex flex-wrap items-end justify-between gap-3 pb-4">
          <div>
            <p className="kicker">{t.ui.kicker}</p>
            <h1 id="jobs-title" className="text-title mt-1 font-black">
              {t.jobs.title}
            </h1>
          </div>
          <p className="text-muted-foreground text-sm" aria-live="polite" data-testid="result-count">
            <span className="text-foreground font-mono font-medium">{total.toLocaleString()}</span> {t.jobs.results}
            {filters.q && (
              <>
                {" "}
                <span dir="auto">{fillQ(ss.resultsFor, filters.q)}</span>
              </>
            )}{" "}
            · {s.sorts[sort]}
          </p>
        </header>

        <SearchBox s={ss.jobs} suggestions={suggestions} testId="jobs-search" />

        <div className="flex flex-wrap items-center gap-2">
          <FilterSheet label={t.ui.filters} count={nFilters}>
            <JobFilterForm {...formProps} idPrefix="m" />
          </FilterSheet>
          <SortMenu
            label={s.sortLabel}
            heading={s.sortBy}
            current={sort}
            options={sortOptions}
            hint={hasProfile ? undefined : s.matchSortHint}
          />
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" data-testid="active-chips">
            <ul className="contents" aria-label={t.ui.activeFilters}>
              {chips.map((c) => (
                <li key={c.key}>
                  <Link
                    href={c.href}
                    className="bg-secondary hover:bg-secondary/70 inline-flex min-h-9 items-center gap-1 rounded-full ps-3 pe-2 text-sm font-semibold"
                    aria-label={`${t.ui.removeFilter}: ${c.label}`}
                    dir="auto"
                  >
                    {c.label}
                    <X className="size-3.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href={clearHref}
              className="text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center px-2 text-sm underline underline-offset-4"
            >
              {s.clearAll}
            </Link>
          </div>
        )}

        {!hasProfile && (
          <p className="border-primary bg-card border-s-4 px-4 py-3 text-sm">
            {t.jobs.matchLoginHint}{" "}
            {!session?.user && (
              <Link
                href="/login?next=/profile"
                className="text-primary inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline"
              >
                {t.nav.login}
              </Link>
            )}
          </p>
        )}

        {welcome && hasProfile && (
          <p role="status" className="bg-fit-soft border-fit border-s-4 px-4 py-3 text-sm font-semibold">
            {t.pv2.welcome}
          </p>
        )}

        {fitStrip.length > 0 && (
          <section aria-labelledby="fit-h" className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="fit-h" className="kicker">
                {s.fitCompaniesTitle}
              </h2>
              <Link
                href={href({ ...filters, fit: true, page: 1 })}
                className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center text-sm underline underline-offset-4"
              >
                {s.fitCompaniesMore}
              </Link>
            </div>
            <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="list">
              {fitStrip.map((f) => (
                <li key={f.companyId} className="shrink-0">
                  <Link
                    href={href({ ...filters, company: [f.company.slug], page: 1 })}
                    className="bg-card hover:bg-muted flex min-h-11 flex-col rounded-md border px-3 py-2 text-sm"
                  >
                    <span className="font-bold" dir="auto">
                      {f.company.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {fill(s.fitRoles, f.count)} · {f.best}%
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {top.length > 0 && (
          <section aria-labelledby="top-h" className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="top-h" className="kicker">
                {t.pv2.topMatches}
              </h2>
              <Link
                href="/profile?tab=prefs"
                className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center text-sm underline underline-offset-4"
              >
                {t.pv2.tuneMatches}
              </Link>
            </div>
            <JobList>
              {top.map(({ job, score }) => (
                <JobCard key={job.id} job={job} t={t} score={score} />
              ))}
            </JobList>
          </section>
        )}

        {top.length > 0 && <h2 className="kicker pt-2">{s.sorts[sort]}</h2>}

        {rows.length === 0 ? (
          <div
            className="bg-card text-muted-foreground flex flex-col items-center gap-3 rounded-lg border p-8 text-center"
            data-testid="jobs-empty"
          >
            {filters.q ? (
              <>
                <p className="text-foreground text-lg font-bold break-words" dir="auto">
                  {fillQ(ss.noResultsFor, filters.q)}
                </p>
                <p className="max-w-md text-sm">{ss.noResultsHint}</p>
              </>
            ) : (
              <p>{t.jobs.noResults}</p>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              {filters.q && (
                <Button asChild variant="outline">
                  <Link href={clearSearchHref}>{ss.clearSearch}</Link>
                </Button>
              )}
              {nFilters > (filters.q ? 1 : 0) && (
                <Button asChild variant="outline">
                  <Link href={clearHref}>{ss.clearFilters}</Link>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <JobList>
            {rows.map(({ job, score }) => (
              <JobCard key={job.id} job={job} t={t} score={score} highlight={marks} />
            ))}
          </JobList>
        )}

        {pages > 1 && (
          <nav className="flex items-center justify-between gap-3 pt-2" aria-label={t.ui.page}>
            {filters.page > 1 ? (
              <Button asChild variant="outline">
                <Link href={href({ ...filters, page: filters.page - 1 })} rel="prev">
                  <ChevronLeft data-icon="inline-start" aria-hidden className="rtl:-scale-x-100" />
                  {t.jobs.prev}
                </Link>
              </Button>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground font-mono text-sm">
              {t.ui.page} {filters.page} {t.ui.of} {pages}
            </span>
            {filters.page < pages ? (
              <Button asChild variant="outline">
                <Link href={href({ ...filters, page: filters.page + 1 })} rel="next">
                  {t.jobs.next}
                  <ChevronRight data-icon="inline-end" aria-hidden className="rtl:-scale-x-100" />
                </Link>
              </Button>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
      <BackToTop label={t.ui.backToTop} />
    </div>
  );
}
