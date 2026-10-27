import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { auth } from "@/auth";
import { FilterSheet } from "@/components/FilterSheet";
import { JobCard, JobList } from "@/components/JobCard";
import { JobFilterForm } from "@/components/JobFilters";
import { Button } from "@/components/ui/button";
import { computeMatch } from "@/lib/ai/match";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { filtersToQuery, filtersToWhere, PAGE_SIZE, parseFilters, type JobFilters } from "@/lib/jobs/filters";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Jobs" };

const FILTER_KEYS = ["q", "role", "seniority", "location", "workMode", "tech", "company"] as const;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ t }, session, params] = await Promise.all([getDictionary(), auth(), searchParams]);
  const filters = parseFilters(params);
  const where = filtersToWhere(filters);
  const [total, jobs, profile] = await Promise.all([
    db.job.count({ where }),
    db.job.findMany({
      where,
      include: { company: true },
      orderBy: { postedAt: "desc" },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    session?.user?.id ? db.profile.findUnique({ where: { userId: session.user.id } }) : null,
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasProfile = profile && profile.skills.length > 0;
  const active = FILTER_KEYS.filter((k) => filters[k]);
  const label = (k: (typeof FILTER_KEYS)[number]) => {
    const v = filters[k]!;
    if (k === "role") return t.roles[v];
    if (k === "seniority") return t.seniority[v];
    if (k === "workMode") return t.workMode[v];
    return v;
  };
  const without = (k: keyof JobFilters) => `/jobs${filtersToQuery({ ...filters, [k]: undefined, page: 1 })}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <h2 className="kicker mb-4">{t.ui.filters}</h2>
          <JobFilterForm t={t} filters={filters} idPrefix="d" />
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
          <p className="text-muted-foreground text-sm" aria-live="polite">
            <span className="text-foreground font-mono font-medium">{total.toLocaleString()}</span> {t.jobs.results} ·{" "}
            {t.ui.sortedNewest}
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSheet label={t.ui.filters} count={active.length}>
            <JobFilterForm t={t} filters={filters} idPrefix="m" />
          </FilterSheet>
          {active.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label={t.ui.activeFilters}>
              {active.map((k) => (
                <li key={k}>
                  <Link
                    href={without(k)}
                    className="bg-secondary hover:bg-secondary/70 inline-flex min-h-9 items-center gap-1 rounded-full ps-3 pe-2 text-sm font-semibold"
                    aria-label={`${t.ui.removeFilter}: ${label(k)}`}
                  >
                    {label(k)}
                    <X className="size-3.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

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

        {jobs.length === 0 ? (
          <p className="bg-card text-muted-foreground rounded-lg border p-8 text-center">{t.jobs.noResults}</p>
        ) : (
          <JobList>
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                t={t}
                score={hasProfile ? computeMatch({ ...profile, skills: profile.skills }, job).score : undefined}
              />
            ))}
          </JobList>
        )}

        {pages > 1 && (
          <nav className="flex items-center justify-between gap-3 pt-2" aria-label={t.ui.page}>
            {filters.page > 1 ? (
              <Button asChild variant="outline">
                <Link href={`/jobs${filtersToQuery({ ...filters, page: filters.page - 1 })}`} rel="prev">
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
                <Link href={`/jobs${filtersToQuery({ ...filters, page: filters.page + 1 })}`} rel="next">
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
    </div>
  );
}
