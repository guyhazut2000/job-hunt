import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fill, type JobSearchStrings } from "@/lib/i18n/job-search";
import { localeOf } from "@/lib/i18n/salary";
import { EMPLOYMENT_TYPES, JOB_LEVELS } from "@/lib/jobs/classify";
import { DOMAIN_LABELS, JOB_DOMAINS } from "@/lib/jobs/domains";
import {
  COMPANY_FIT_THRESHOLD,
  MIN_MATCH_OPTIONS,
  POSTED_WINDOWS,
  type JobFilters as Filters,
} from "@/lib/jobs/filters";
import { ROLE_CATEGORIES, TECH_KEYWORDS, WORK_MODES } from "@/lib/taxonomy";
import { Button } from "@/components/ui/button";
import { CleanGetForm } from "./CleanGetForm";
import { CompanyPicker, type CompanyOption } from "./CompanyPicker";
import { FacetList, type FacetItem } from "./FacetList";

const TECH_OPTIONS = [...new Set(Object.values(TECH_KEYWORDS))].sort();

/** Counts over all open roles, used to label options and hide empty ones. */
export interface Facets {
  fn: Record<string, number>;
  domain: Record<string, number>;
  level: Record<string, number>;
  type: Record<string, number>;
  workMode: Record<string, number>;
  cities: [string, number][];
  companies: CompanyOption[];
}

/** Plain GET form — works without JS. Rendered twice (sidebar + mobile sheet), hence idPrefix. */
export function JobFilterForm({
  t,
  s,
  filters,
  facets,
  idPrefix,
  hasProfile,
  signedIn,
  clearHref,
}: {
  t: Dictionary;
  s: JobSearchStrings;
  filters: Filters;
  facets: Facets;
  idPrefix: string;
  hasProfile: boolean;
  signedIn: boolean;
  clearHref: string;
}) {
  const id = (n: string) => `${idPrefix}-${n}`;
  const keep = <T extends string>(all: readonly T[], counts: Record<string, number>, sel: readonly string[]) =>
    all.filter((v) => (counts[v] ?? 0) > 0 || sel.includes(v));
  return (
    <CleanGetForm action="/jobs" className="flex flex-col gap-1" role="search" data-testid={`filters-${idPrefix}`}>
      {filters.sort && <input type="hidden" name="sort" value={filters.sort} />}
      {filters.seniority && <input type="hidden" name="seniority" value={filters.seniority} />}
      {/* The free-text query has its own search bar above the results; keep it when filters are applied. */}
      {filters.q && <input type="hidden" name="q" value={filters.q} />}

      <Section title={s.sections.posted} count={filters.posted ? 1 : 0} open>
        <div className="flex flex-wrap gap-1.5">
          {(["any", ...Object.keys(POSTED_WINDOWS)] as const).map((p) => (
            <label key={p} className="toggle-chip">
              <input
                type="radio"
                name="posted"
                value={p === "any" ? "" : p}
                defaultChecked={(filters.posted ?? "any") === p}
                className="sr-only"
              />
              {s.posted[p as keyof typeof s.posted]}
            </label>
          ))}
        </div>
      </Section>

      <Section title={s.sections.match} count={(filters.minMatch ? 1 : 0) + (filters.fit ? 1 : 0)} open={hasProfile}>
        {hasProfile ? (
          <div className="flex flex-col gap-3">
            <fieldset>
              <legend className="label">{s.minMatch}</legend>
              <div className="flex flex-wrap gap-1.5">
                {[undefined, ...MIN_MATCH_OPTIONS].map((m) => (
                  <label key={m ?? "any"} className="toggle-chip">
                    <input
                      type="radio"
                      name="minMatch"
                      value={m ?? ""}
                      defaultChecked={filters.minMatch === m}
                      className="sr-only"
                    />
                    {m ? `${m}%+` : s.minMatchAny}
                  </label>
                ))}
              </div>
            </fieldset>
            <Check name="fit" value="1" checked={!!filters.fit} label={s.fitOnly} />
            <p className="text-muted-foreground text-xs">{fill(s.fitHint, COMPANY_FIT_THRESHOLD)}</p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{s.matchNeedsProfile}</p>
        )}
      </Section>

      {signedIn && (
        <Section title={s.sections.hide} count={filters.hide.length}>
          <div className="flex flex-col">
            <Check name="hide" value="saved" checked={filters.hide.includes("saved")} label={s.hideSaved} />
            <Check name="hide" value="applied" checked={filters.hide.includes("applied")} label={s.hideApplied} />
          </div>
        </Section>
      )}

      <Section title={s.sections.fn} count={filters.domain.length + filters.fn.length + (filters.role ? 1 : 0)} open>
        {/* Domain (תחום) supersedes the broad job function; old `fn` links still filter (chip removes them). */}
        {filters.fn.map((v) => (
          <input key={v} type="hidden" name="fn" value={v} />
        ))}
        <CheckList
          s={s}
          name="domain"
          items={keep(JOB_DOMAINS, facets.domain, filters.domain)
            .map((v): FacetItem => [v, DOMAIN_LABELS[localeOf(t)][v], facets.domain[v] ?? 0])
            .sort((a, b) => (a[0] === "other" ? 1 : b[0] === "other" ? -1 : b[2] - a[2]))}
          selected={filters.domain}
        />
        <div className="pt-3">
          <label className="label" htmlFor={id("role")}>
            {s.sections.role}
          </label>
          <select id={id("role")} name="role" defaultValue={filters.role ?? ""} className="select-native">
            <option value="">{t.jobs.any}</option>
            {ROLE_CATEGORIES.map((r) => (
              <option key={r} value={r}>
                {t.roles[r]}
              </option>
            ))}
          </select>
        </div>
      </Section>

      <Section title={s.sections.level} count={filters.level.length} open>
        <CheckList
          s={s}
          name="level"
          items={keep(JOB_LEVELS, facets.level, filters.level).map((v) => [v, s.levels[v], facets.level[v] ?? 0])}
          selected={filters.level}
        />
      </Section>

      <Section title={s.sections.city} count={filters.city.length} open>
        <CheckList
          s={s}
          name="city"
          items={[
            ...facets.cities.map(([c, n]) => [c, c, n] as [string, string, number]),
            ...filters.city
              .filter((c) => !facets.cities.some(([x]) => x === c))
              .map((c) => [c, c, 0] as [string, string, number]),
          ]}
          selected={filters.city}
        />
      </Section>

      <Section title={s.sections.workMode} count={filters.workMode.length} open>
        <CheckList
          s={s}
          name="workMode"
          items={WORK_MODES.map((w) => [w, t.workMode[w], facets.workMode[w] ?? 0])}
          selected={filters.workMode}
        />
      </Section>

      <Section title={s.sections.company} count={filters.company.length} open={filters.company.length > 0}>
        <CompanyPicker
          id={id("company")}
          companies={facets.companies}
          selected={filters.company}
          placeholder={s.companySearch}
          empty={s.companyNone}
          moreLabel={s.showMore}
          lessLabel={s.showLess}
        />
      </Section>

      <Section title={s.sections.type} count={filters.type.length}>
        <CheckList
          s={s}
          name="type"
          items={keep(EMPLOYMENT_TYPES, facets.type, filters.type).map((v) => [v, s.types[v], facets.type[v] ?? 0])}
          selected={filters.type}
        />
      </Section>

      <Section title={s.sections.tech} count={filters.tech ? 1 : 0}>
        <label className="sr-only" htmlFor={id("tech")}>
          {t.jobs.tech}
        </label>
        <select id={id("tech")} name="tech" defaultValue={filters.tech ?? ""} className="select-native">
          <option value="">{t.jobs.any}</option>
          {TECH_OPTIONS.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </Section>

      <p className="text-muted-foreground pt-2 text-xs">{s.allOpenRoles}</p>

      {/* Sticky so the action stays reachable while the sheet scrolls. */}
      <div className="filter-footer bg-popover lg:bg-background sticky bottom-0 z-10 -mx-1 mt-2 flex gap-2 border-t px-1 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <Button type="submit" className="flex-1">
          {idPrefix === "m" ? t.ui.showResults : s.apply}
        </Button>
        <Button asChild variant="outline">
          <Link href={clearHref}>{s.clearAll}</Link>
        </Button>
      </div>
    </CleanGetForm>
  );
}

function Section({
  title,
  count,
  open,
  children,
}: {
  title: string;
  count: number;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-rule/60 border-t py-1" open={open || count > 0}>
      <summary className="hover:text-primary -mx-1 flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-md px-1 text-sm font-semibold select-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center">
          {title}
          {count > 0 && (
            <span className="bg-primary text-primary-foreground ms-2 inline-grid size-5 place-items-center rounded-full font-mono text-[0.7rem]">
              {count}
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden
          className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="pt-0.5 pb-3">{children}</div>
    </details>
  );
}

function Check({ name, value, checked, label }: { name: string; value: string; checked: boolean; label: string }) {
  return (
    <label className="hover:bg-muted -mx-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="accent-primary size-4" />
      <span className="flex-1">{label}</span>
    </label>
  );
}

function CheckList({
  s,
  name,
  items,
  selected,
}: {
  s: JobSearchStrings;
  name: string;
  items: FacetItem[];
  selected: readonly string[];
}) {
  return (
    <FacetList
      name={name}
      items={items}
      selected={selected}
      labels={{
        showAll: fill(s.showAll, items.length),
        showLess: s.showLess,
        search: fill(s.listSearch, items.length),
        none: s.listNone,
      }}
    />
  );
}
