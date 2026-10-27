import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { JobCard } from "@/components/JobCard";
import { computeMatch } from "@/lib/ai/match";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { filtersToQuery, filtersToWhere, PAGE_SIZE, parseFilters } from "@/lib/jobs/filters";
import { LOCATIONS, ROLE_CATEGORIES, SENIORITIES, TECH_KEYWORDS, WORK_MODES } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Jobs" };

const TECH_OPTIONS = [...new Set(Object.values(TECH_KEYWORDS))].sort();

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

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside>
        <form className="card space-y-4" method="get">
          <div>
            <label className="label" htmlFor="q">
              {t.jobs.search}
            </label>
            <input id="q" name="q" defaultValue={filters.q} className="input" />
          </div>
          <Select
            name="role"
            label={t.jobs.role}
            any={t.jobs.any}
            value={filters.role}
            options={ROLE_CATEGORIES.map((r) => [r, t.roles[r]])}
          />
          <Select
            name="seniority"
            label={t.jobs.seniority}
            any={t.jobs.any}
            value={filters.seniority}
            options={SENIORITIES.map((s) => [s, t.seniority[s]])}
          />
          <Select
            name="location"
            label={t.jobs.location}
            any={t.jobs.any}
            value={filters.location}
            options={LOCATIONS.map((l) => [l, l])}
          />
          <Select
            name="workMode"
            label={t.jobs.workMode}
            any={t.jobs.any}
            value={filters.workMode}
            options={WORK_MODES.map((w) => [w, t.workMode[w]])}
          />
          <Select
            name="tech"
            label={t.jobs.tech}
            any={t.jobs.any}
            value={filters.tech}
            options={TECH_OPTIONS.map((s) => [s, s])}
          />
          <div className="flex gap-2">
            <button className="btn-primary flex-1" type="submit">
              {t.jobs.filter}
            </button>
            <Link href="/jobs" className="btn-ghost">
              {t.jobs.clear}
            </Link>
          </div>
        </form>
      </aside>
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold">{t.jobs.title}</h1>
          <span className="text-sm text-slate-500">
            {total.toLocaleString()} {t.jobs.results}
          </span>
        </div>
        {!hasProfile && (
          <p className="bg-brand-50 text-brand-700 rounded-lg px-4 py-2 text-sm">{t.jobs.matchLoginHint}</p>
        )}
        {jobs.length === 0 && <p className="card text-slate-600">{t.jobs.noResults}</p>}
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            t={t}
            score={hasProfile ? computeMatch({ ...profile, skills: profile.skills }, job).score : undefined}
          />
        ))}
        {pages > 1 && (
          <nav className="flex items-center justify-center gap-3 pt-2 text-sm">
            {filters.page > 1 && (
              <Link className="btn-ghost" href={`/jobs${filtersToQuery({ ...filters, page: filters.page - 1 })}`}>
                {t.jobs.prev}
              </Link>
            )}
            <span>
              {filters.page} / {pages}
            </span>
            {filters.page < pages && (
              <Link className="btn-ghost" href={`/jobs${filtersToQuery({ ...filters, page: filters.page + 1 })}`}>
                {t.jobs.next}
              </Link>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}

function Select({
  name,
  label,
  any,
  value,
  options,
}: {
  name: string;
  label: string;
  any: string;
  value?: string;
  options: [string, string][];
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <select id={name} name={name} defaultValue={value ?? ""} className="input">
        <option value="">{any}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
