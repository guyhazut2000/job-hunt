import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { JobFilters as Filters } from "@/lib/jobs/filters";
import { LOCATIONS, ROLE_CATEGORIES, SENIORITIES, TECH_KEYWORDS, WORK_MODES } from "@/lib/taxonomy";
import { Button } from "@/components/ui/button";

const TECH_OPTIONS = [...new Set(Object.values(TECH_KEYWORDS))].sort();

/** Plain GET form — works without JS. Rendered twice (sidebar + mobile sheet), hence idPrefix. */
export function JobFilterForm({ t, filters, idPrefix }: { t: Dictionary; filters: Filters; idPrefix: string }) {
  const id = (n: string) => `${idPrefix}-${n}`;
  return (
    <form method="get" action="/jobs" className="flex flex-col gap-4" role="search">
      {filters.company && <input type="hidden" name="company" value={filters.company} />}
      <div>
        <label className="label" htmlFor={id("q")}>
          {t.jobs.search}
        </label>
        <input id={id("q")} name="q" type="search" defaultValue={filters.q} className="input" enterKeyHint="search" />
      </div>
      <Select
        id={id("role")}
        name="role"
        label={t.jobs.role}
        any={t.jobs.any}
        value={filters.role}
        options={ROLE_CATEGORIES.map((r) => [r, t.roles[r]])}
      />
      <Select
        id={id("seniority")}
        name="seniority"
        label={t.jobs.seniority}
        any={t.jobs.any}
        value={filters.seniority}
        options={SENIORITIES.map((s) => [s, t.seniority[s]])}
      />
      <Select
        id={id("location")}
        name="location"
        label={t.jobs.location}
        any={t.jobs.any}
        value={filters.location}
        options={LOCATIONS.map((l) => [l, l])}
      />
      <Select
        id={id("workMode")}
        name="workMode"
        label={t.jobs.workMode}
        any={t.jobs.any}
        value={filters.workMode}
        options={WORK_MODES.map((w) => [w, t.workMode[w]])}
      />
      <Select
        id={id("tech")}
        name="tech"
        label={t.jobs.tech}
        any={t.jobs.any}
        value={filters.tech}
        options={TECH_OPTIONS.map((s) => [s, s])}
      />
      <div className="flex gap-2 pt-1">
        <Button type="submit" className="flex-1">
          {idPrefix === "m" ? t.ui.showResults : t.jobs.filter}
        </Button>
        <Button asChild variant="outline">
          <Link href="/jobs">{t.jobs.clear}</Link>
        </Button>
      </div>
    </form>
  );
}

function Select({
  id,
  name,
  label,
  any,
  value,
  options,
}: {
  id: string;
  name: string;
  label: string;
  any: string;
  value?: string;
  options: [string, string][];
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <select id={id} name={name} defaultValue={value ?? ""} className="select-native">
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
