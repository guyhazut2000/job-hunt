import type { Metadata } from "next";
import type { Company, Job } from "@prisma/client";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { auth } from "@/auth";
import { FilterSheet } from "@/components/FilterSheet";
import { ScrollFade } from "@/components/ScrollFade";
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
import { DOMAIN_LABELS, type JobDomain } from "@/lib/jobs/domains";
import { matchCompanies, rankJob } from "@/lib/jobs/search";
import { highlightTerms, parseSearchQuery } from "@/lib/search/query";
import { fillQ, searchStrings } from "@/lib/i18n/search";
import { SearchBox, type SearchSuggestion } from "@/components/SearchBox";
import { List, Map as MapIcon } from "lucide-react";
import { CommuteBar } from "@/components/map/CommuteBar";
import { JobsMap } from "@/components/map/JobsMap";
import { filterByCommute, sortByCommute } from "@/lib/commute/filter";
import { commuteForJobs, commuteSeconds, type JobCommute } from "@/lib/commute/jobs";
import { destKey, parseDeparture } from "@/lib/commute/keys";
import { listSavedPlaces, resolveOrigin } from "@/lib/commute/origin";
import { getCommuteTimes } from "@/lib/commute/service";
import { companyGeoSelect } from "@/lib/geo/job-points";
import { buildMarkers } from "@/lib/geo/map-markers";
import { fillN, jobsMapStrings } from "@/lib/i18n/jobs-map";
import { LastScanIndicator } from "@/components/LastScanIndicator";
import { lastScanStrings } from "@/lib/i18n/last-scan";
import { formatRelative, nextScheduledScan, scanStatus } from "@/lib/ingestion/last-scan";
import { lastScanSafe } from "@/lib/ingestion/last-scan-server";
import { formatDateTime } from "@/lib/format";
import { SaveSearchButton } from "@/components/notifications/SaveSearchButton";
import { notificationStrings } from "@/lib/i18n/notifications";
import { alertFilters, defaultSearchName } from "@/lib/notifications/saved-search";

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
  const ms = jobsMapStrings(locale);
  const parsed = parseFilters(params);
  const isMap = parsed.view === "map";
  // Commute origin: ad-hoc rounded point, a saved place, or (map view) the default saved place.
  const [profile, origin, savedPlaces, lastScan] = await Promise.all([
    userId ? db.profile.findUnique({ where: { userId } }) : null,
    resolveOrigin(parsed, userId, isMap),
    listSavedPlaces(userId),
    lastScanSafe(),
  ]);
  const now = new Date();
  const nextScan = nextScheduledScan(now);
  const filters: JobFilters = {
    ...parsed,
    from: origin?.source === "here" ? parsed.from : undefined,
    origin: origin?.placeId ?? (parsed.origin === "none" ? "none" : undefined),
    cmode: origin ? parsed.cmode : undefined,
    maxc: origin ? parsed.maxc : undefined,
  };
  const candidate = hasScorableProfile(profile) ? toCandidate(profile) : null;
  const hasProfile = !!candidate;
  const sort = effectiveSort(filters, hasProfile);
  const terms = parseSearchQuery(filters.q);
  const href = (f: JobFilters) => `/jobs${filtersToQuery(f)}`;

  // Facet counts are over all open roles (cheap: a handful of grouped queries on ~600 rows).
  const active = { isActive: true } as const;
  const [fnG, domainG, levelG, typeG, modeG, companyG, locRows, techRows] = await Promise.all([
    db.job.groupBy({ by: ["jobFunction"], where: active, _count: true }),
    db.job.groupBy({ by: ["domain"], where: active, _count: true }),
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
  const baseWhere = filtersToWhere(filters, { userId, companyMatches });
  const departure = parseDeparture(filters.dep);
  const commuteOpts = origin ? { origin: origin.point, departure } : null;

  // Commute filter / sort: one cached, batched matrix over every matching job's places.
  let commuteOrder: string[] | null = null;
  let estimated = false;
  if (commuteOpts && (sort === "commute" || filters.maxc)) {
    const light = await db.job.findMany({
      where: baseWhere,
      select: { id: true, geoPlaces: true, geoPrecision: true, company: { select: companyGeoSelect } },
    });
    const { byJob, batch } = await commuteForJobs(light, commuteOpts);
    estimated ||= batch.estimated;
    const sec = (j: { id: string }) => commuteSeconds(byJob.get(j.id), filters.cmode);
    let list = filterByCommute(light, sec, filters.maxc ?? null);
    if (sort === "commute") list = sortByCommute(list, sec);
    commuteOrder = list.map((j) => j.id);
  }
  const where = filters.maxc && commuteOrder ? { AND: [baseWhere, { id: { in: commuteOrder } }] } : baseWhere;
  const commuteRank = new Map((commuteOrder ?? []).map((id, i) => [id, i]));
  const marks = highlightTerms(terms);
  const count = <K extends string>(rows: ({ _count: number } & Record<K, string>)[], k: K) =>
    Object.fromEntries(rows.map((r) => [r[k], r._count]));
  const companyCount = count(companyG, "companyId");
  const facets: Facets = {
    fn: count(fnG, "jobFunction"),
    domain: count(domainG, "domain"),
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
      .sort(
        sort === "commute"
          ? (a, b) => (commuteRank.get(a.job.id) ?? Infinity) - (commuteRank.get(b.job.id) ?? Infinity)
          : compareJobs(sort),
      );
    total = matching.length;
    rows = matching.slice((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE);
  } else if (sort === "commute" && commuteOrder) {
    total = commuteOrder.length;
    const ids = commuteOrder.slice((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE);
    const full = await db.job.findMany({ where: { id: { in: ids } }, include: { company: true } });
    const byId = new Map(full.map((j) => [j.id, j]));
    rows = ids
      .map((id) => byId.get(id))
      .filter((j): j is Job & { company: Company } => !!j)
      .map((job) => ({ job, score: candidate ? scoreMatch(candidate, job).score : undefined }));
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

  // Commute chips on the visible cards (list view; mostly cache hits after the filter above).
  let rowCommute: Map<string, JobCommute> | null = null;
  if (commuteOpts && !isMap && rows.length) {
    const r = await commuteForJobs(
      rows.map((x) => x.job),
      commuteOpts,
    );
    rowCommute = r.byJob;
    estimated ||= r.batch.estimated;
  }

  // Map view: company×place markers for every matching job, with commute per marker.
  let map: ReturnType<typeof buildMarkers> | null = null;
  if (isMap) {
    const mapRows = await db.job.findMany({
      where,
      select: {
        id: true,
        title: true,
        workMode: true,
        domain: true,
        geoPlaces: true,
        geoPrecision: true,
        company: { select: { ...companyGeoSelect, name: true, slug: true } },
      },
      orderBy: [{ postedAt: "desc" }, { id: "asc" }],
      take: 3000,
    });
    const scores = new Map(scoredAll.map((x) => [x.job.id, x.score]));
    map = buildMarkers(mapRows, locale, candidate ? scores : undefined);
    if (commuteOpts && map.markers.length) {
      const batch = await getCommuteTimes({ ...commuteOpts, dests: map.markers.map((m) => m.dest) });
      estimated ||= batch.estimated;
      for (const m of map.markers) m.commute = batch.times.get(destKey(m.dest));
    }
  }
  const welcome = params.welcome === "1";
  const nFilters = activeFilterCount(filters);
  const alertQuery = filtersToQuery(alertFilters(filters)).replace(/^\?/, "");
  const alreadySaved =
    !!userId &&
    !!alertQuery &&
    !!(await db.savedSearch.findFirst({ where: { userId, query: alertQuery }, select: { id: true } }));
  const ns = notificationStrings(locale);

  // Strip of the best matches, only when the list itself isn't already match-ordered.
  const top =
    candidate && !isMap && sort !== "match" && filters.page === 1 && nFilters === 0
      ? [...scoredAll]
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .filter((x) => x.score >= 40)
      : [];
  const fitStrip =
    candidate && !isMap && filters.page === 1 && !filters.fit && filters.company.length === 0
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
  for (const v of filters.domain) chip("domain", DOMAIN_LABELS[locale][v as JobDomain] ?? v, v);
  for (const v of filters.fn) chip("fn", s.functions[v as keyof typeof s.functions] ?? v, v);
  if (filters.role) chip("role", t.roles[filters.role]);
  if (filters.seniority) chip("seniority", t.seniority[filters.seniority]);
  for (const v of filters.level) chip("level", s.levels[v], v);
  for (const v of filters.city) chip("city", v, v);
  for (const v of filters.workMode) chip("workMode", t.workMode[v], v);
  for (const v of filters.company) chip("company", companyRows.find((c) => c.slug === v)?.name ?? v, v);
  for (const v of filters.type) chip("type", s.types[v], v);
  if (filters.tech) chip("tech", filters.tech);
  if (filters.maxc)
    chip("maxc", `${filters.cmode ? ms.modes[filters.cmode] : ms.commute} ${fillN(ms.upTo, { n: filters.maxc })}`);
  const clearHref = href(clearedFilters(filters));

  const sortOptions = SORTS.filter((k) => k !== "relevance" || terms.length > 0).map((k) => ({
    key: k,
    label: s.sorts[k],
    href: href({ ...filters, sort: k, page: 1 }),
    disabled: (k === "match" && !hasProfile) || (k === "commute" && !origin),
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
        {/* Sticky below the site header; only the filter list scrolls (thin scrollbar + edge fades),
            and only when it's taller than the viewport. */}
        <div className="sticky top-[calc(var(--header-h)+1.5rem)] flex max-h-[calc(100dvh-var(--header-h)-2.5rem)] flex-col">
          <h2 className="kicker mb-2 flex items-center gap-2">
            {t.ui.filters}
            {nFilters > 0 && (
              <span className="bg-primary text-primary-foreground inline-grid size-5 place-items-center rounded-full font-mono text-[0.7rem] tracking-normal">
                {nFilters}
              </span>
            )}
          </h2>
          <ScrollFade className="-me-4 pe-1" bottomFade={false} data-filter-scroll>
            <JobFilterForm {...formProps} idPrefix="d" />
          </ScrollFade>
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
          <div className="flex flex-col items-start gap-0.5 sm:items-end">
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
            <LastScanIndicator
              scan={lastScan}
              s={lastScanStrings(locale)}
              locale={t.dateLocale}
              initialRelative={lastScan ? formatRelative(lastScan.finishedAt, t.dateLocale, now) : ""}
              initialStatus={lastScan ? scanStatus(lastScan, now) : "stale"}
              exactTime={lastScan ? formatDateTime(new Date(lastScan.finishedAt), t.dateLocale) : ""}
              nextTime={nextScan ? formatDateTime(nextScan, t.dateLocale) : null}
            />
          </div>
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
          {userId && alertQuery && (
            <SaveSearchButton
              query={alertQuery}
              defaultName={defaultSearchName(filters, ns.allJobs)}
              alreadySaved={alreadySaved}
              labels={ns}
            />
          )}
          <nav
            className="bg-muted ms-auto inline-flex rounded-md p-0.5"
            aria-label={ms.viewLabel}
            data-testid="view-toggle"
          >
            {(
              [
                ["list", List, ms.viewList],
                ["map", MapIcon, ms.viewMap],
              ] as const
            ).map(([v, Icon, label]) => (
              <Link
                key={v}
                href={href({ ...filters, view: v === "map" ? "map" : undefined, page: 1 })}
                aria-current={(v === "map") === isMap ? "page" : undefined}
                className={
                  (v === "map") === isMap
                    ? "bg-background inline-flex min-h-9 items-center gap-1.5 rounded px-3 text-sm font-bold shadow-sm"
                    : "text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center gap-1.5 rounded px-3 text-sm font-semibold"
                }
                data-testid={`view-${v}`}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <CommuteBar
          s={ms}
          savedPlaces={savedPlaces.map((p) => ({ id: p.id, label: p.label }))}
          origin={origin ? { source: origin.source, placeId: origin.placeId } : null}
          cmode={filters.cmode}
          maxc={filters.maxc}
          dep={filters.dep}
          view={isMap ? "map" : "list"}
          signedIn={!!userId}
        />
        {filters.maxc && <p className="text-muted-foreground -mt-2 text-xs">{ms.commuteFilterDropped}</p>}

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
            <ul className="scroll-chips -mx-1 flex gap-2 px-1 pb-1" role="list">
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

        {map ? (
          <>
            <JobsMap
              markers={map.markers}
              origin={
                origin
                  ? {
                      lat: origin.point.lat,
                      lng: origin.point.lng,
                      label: origin.label ?? ms.customPoint,
                    }
                  : null
              }
              s={ms}
              locale={locale}
              cmode={filters.cmode}
              dep={filters.dep}
              remote={map.remote}
              unmapped={map.unmapped}
              estimated={estimated}
              workModeLabels={t.workMode}
            />
            <p className="text-muted-foreground text-[11px] lg:hidden">
              © OpenFreeMap · OpenStreetMap · GeoNames ·{" "}
              <a href="https://transitous.org/sources/" target="_blank" rel="noopener" className="underline">
                {ms.attributionTransit} ({ms.sources})
              </a>
            </p>
          </>
        ) : rows.length === 0 ? (
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
              <JobCard
                key={job.id}
                job={job}
                t={t}
                score={score}
                highlight={marks}
                commute={rowCommute?.get(job.id)?.commute}
                commuteMode={filters.cmode}
              />
            ))}
          </JobList>
        )}

        {!isMap && pages > 1 && (
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
