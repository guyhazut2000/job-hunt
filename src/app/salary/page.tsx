import { ShowMoreList } from "@/components/density/ShowMoreList";
import { densityStrings } from "@/lib/i18n/density";
import Link from "next/link";
import { ExternalLink, Trash2 } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { FAMILY_LABELS, LEVEL_LABELS } from "@/lib/i18n/salary";
import { fill, SALARY_CITIES, salaryHubStrings, type SalaryCity } from "@/lib/i18n/salary-hub";
import { localizedTitle } from "@/lib/i18n/titles";
import { referenceBand } from "@/lib/salary/estimate";
import {
  REFERENCE,
  SALARY_FAMILIES,
  SALARY_LEVELS,
  SALARY_SOURCES,
  type SalaryFamily,
  type SalaryLevel,
} from "@/lib/salary/reference";
import { SALARY_EXTERNAL_LINKS } from "@/lib/salary/external";
import { deleteSalaryDataPoint } from "./hub-actions";
import { DataPointForm } from "@/components/salary-hub/DataPointForm";
import { SalaryHeader } from "@/components/salary-hub/SalaryTabs";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("salary");

const pick = <T extends string>(v: unknown, all: readonly T[], dflt: T): T =>
  typeof v === "string" && (all as readonly string[]).includes(v) ? (v as T) : dflt;

/** Salary explorer (#91, docs/salary.md): cited bands, my own numbers, what I asked for. */
export default async function SalaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const [{ locale }, session, sp] = await Promise.all([getDictionary(), auth(), searchParams]);
  const s = salaryHubStrings[locale];
  const family = pick<SalaryFamily>(sp.family, SALARY_FAMILIES, "backend");
  const level = pick<SalaryLevel>(sp.level, SALARY_LEVELS, "MID");
  const city = pick<SalaryCity>(sp.city, SALARY_CITIES, "any");
  const band = referenceBand(family, level);
  const row = REFERENCE[family];
  const nf = new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-GB");
  const ils = (n: number) => `₪${nf.format(Math.round(n))}`;
  const fam = FAMILY_LABELS[locale];
  const lvl = LEVEL_LABELS[locale];
  const userId = session?.user?.id;
  const ds = densityStrings(locale);

  const [points, asked] = userId
    ? await Promise.all([
        db.salaryDataPoint.findMany({
          where: { userId, family, level },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        db.application.findMany({
          where: { userId, askedSalaryMonthly: { not: null } },
          orderBy: { updatedAt: "desc" },
          select: { id: true, title: true, company: true, askedSalaryMonthly: true, salaryNote: true, status: true },
          take: 50,
        }),
      ])
    : [[], []];
  const shown = city === "any" ? points : points.filter((p) => p.city === city);
  const dateFmt = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", { month: "short", year: "numeric" });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <SalaryHeader s={s} active="explore" title={s.title} lead={s.lead} />

      <form
        method="get"
        className="bg-card grid gap-3 rounded-lg border p-4 sm:grid-cols-4"
        data-testid="salary-filters"
      >
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {s.filters.family}
          <select name="family" defaultValue={family} className="bg-background min-h-11 rounded-md border px-2">
            {SALARY_FAMILIES.map((f) => (
              <option key={f} value={f}>
                {fam[f]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {s.filters.level}
          <select name="level" defaultValue={level} className="bg-background min-h-11 rounded-md border px-2">
            {SALARY_LEVELS.map((l) => (
              <option key={l} value={l}>
                {lvl[l]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {s.filters.city}
          <select name="city" defaultValue={city} className="bg-background min-h-11 rounded-md border px-2">
            {SALARY_CITIES.map((c) => (
              <option key={c} value={c}>
                {s.cities[c]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="self-end">
          {s.filters.show}
        </Button>
      </form>

      <section
        aria-labelledby="band-h"
        className="bg-card flex flex-col gap-4 rounded-lg border p-4"
        data-testid="salary-band"
      >
        <div>
          <h2 id="band-h" className="font-heading text-xl font-bold">
            {fill(s.bandTitle, { family: fam[family], level: lvl[level] })}
          </h2>
          <p className="text-muted-foreground text-sm">{s.monthlyGross}</p>
        </div>
        <dl className="grid grid-cols-3 gap-1 text-center sm:gap-2">
          {(
            [
              ["p25", band.p25],
              ["median", band.median],
              ["p75", band.p75],
            ] as const
          ).map(([k, v]) => (
            <div
              key={k}
              className={k === "median" ? "bg-muted min-w-0 rounded-md px-1 py-2" : "min-w-0 rounded-md px-1 py-2"}
            >
              <dt className="text-muted-foreground text-xs">{s[k]}</dt>
              <dd className="font-heading text-lg font-black tabular-nums sm:text-2xl" dir="ltr">
                {ils(v)}
              </dd>
            </div>
          ))}
        </dl>
        {row.coverage === "thin" && <p className="text-caution text-sm">{s.coverageThin}</p>}
        <p className="text-sm" data-testid="salary-city-note">
          {city === "any" || city === "center" ? s.cityCenter : s.cityNoData}
        </p>
        <div>
          <h3 className="text-sm font-bold">{s.sourcesTitle}</h3>
          <ul className="mt-1 flex flex-col gap-1.5 text-sm" data-testid="salary-sources">
            {row.sources.map((id) => {
              const src = SALARY_SOURCES[id];
              if (!src) return null;
              return (
                <li key={id} className="flex flex-wrap items-center gap-x-2">
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground/85 inline-flex items-center gap-1 underline underline-offset-4"
                  >
                    {locale === "he" ? src.nameHe : src.name}
                    <ExternalLink className="size-3 shrink-0" aria-hidden />
                  </a>
                  <span className="text-muted-foreground text-xs">{fill(s.published, { date: src.published })}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">{s.howBuilt}</p>
        </div>
      </section>

      <section aria-labelledby="mine-h" className="flex flex-col gap-3" data-testid="salary-mine">
        <div>
          <h2 id="mine-h" className="font-heading text-xl font-bold">
            {s.mine.title}
          </h2>
          <p className="text-muted-foreground text-sm">{s.mine.lead}</p>
        </div>
        {!userId ? (
          <p className="text-sm">
            <Link href="/login?next=/salary" className="text-primary underline underline-offset-4">
              {s.mine.signIn}
            </Link>
          </p>
        ) : (
          <>
            {shown.length === 0 ? (
              <p className="text-muted-foreground text-sm">{s.mine.empty}</p>
            ) : (
              <ShowMoreList initial={8} step={20} className="divide-y rounded-lg border" s={ds} testId="salary-points">
                {shown.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                    <div className="flex min-w-0 flex-col">
                      <span className="font-semibold">
                        <bdi dir="ltr">{ils(p.monthlyGrossIls)}</bdi>
                        {p.company && (
                          <>
                            {" "}
                            · <bdi>{p.company}</bdi>
                          </>
                        )}
                        <span className="text-muted-foreground ms-2 text-xs">
                          {fill(s.mine.vsMarket, { pct: Math.round((p.monthlyGrossIls / band.median) * 100) })}
                        </span>
                      </span>
                      <span className="text-muted-foreground text-xs" dir="auto">
                        {p.source}
                        {p.observedAt && ` · ${dateFmt.format(p.observedAt)}`}
                        {p.city && ` · ${s.cities[p.city as SalaryCity] ?? p.city}`}
                        {p.note && ` · ${p.note}`}
                      </span>
                    </div>
                    <form action={deleteSalaryDataPoint.bind(null, p.id)}>
                      <Button type="submit" variant="ghost" size="icon" aria-label={s.mine.remove}>
                        <Trash2 aria-hidden />
                      </Button>
                    </form>
                  </li>
                ))}
              </ShowMoreList>
            )}
            <details className="bg-card rounded-lg border p-4" open={shown.length === 0}>
              <summary className="min-h-11 cursor-pointer font-semibold">{s.mine.add}</summary>
              <div className="mt-3">
                <DataPointForm family={family} level={level} city={city} s={s.mine} />
              </div>
            </details>
          </>
        )}
      </section>

      {userId && (
        <section aria-labelledby="asked-h" className="flex flex-col gap-3" data-testid="salary-asked">
          <div>
            <h2 id="asked-h" className="font-heading text-xl font-bold">
              {s.asked.title}
            </h2>
            <p className="text-muted-foreground text-sm">{s.asked.lead}</p>
          </div>
          {asked.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {s.asked.empty}{" "}
              <Link href="/dashboard" className="text-primary underline underline-offset-4">
                {s.asked.board}
              </Link>
            </p>
          ) : (
            // A card list, not a table: no horizontal scroll at 390px, and "הצג עוד" past 8 rows.
            <ShowMoreList
              initial={8}
              step={20}
              className="divide-y rounded-lg border"
              s={ds}
              testId="salary-asked-list"
            >
              {asked.map((a) => (
                <li key={a.id} className="flex flex-col gap-0.5 p-3 text-sm">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="min-w-0">
                      <span className="sr-only">{s.asked.colRole}: </span>
                      <bdi>{a.title}</bdi> · <bdi>{a.company}</bdi>
                    </span>
                    <span className="font-semibold tabular-nums">
                      <span className="sr-only">{s.asked.colAsked}: </span>
                      <bdi dir="ltr">{ils(a.askedSalaryMonthly ?? 0)}</bdi>
                    </span>
                  </span>
                  {a.salaryNote && (
                    <span className="text-muted-foreground line-clamp-2 text-xs" dir="auto" title={a.salaryNote}>
                      <span className="sr-only">{s.asked.colNote}: </span>
                      {a.salaryNote}
                    </span>
                  )}
                </li>
              ))}
            </ShowMoreList>
          )}
        </section>
      )}

      <section aria-labelledby="ext-h" className="flex flex-col gap-2" data-testid="salary-external">
        <h2 id="ext-h" className="font-heading text-lg font-bold">
          {s.externalTitle}
        </h2>
        <p className="text-muted-foreground text-xs">{s.externalNote}</p>
        <ul className="flex flex-col gap-1.5 text-sm">
          {SALARY_EXTERNAL_LINKS.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2">
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex min-h-9 items-center gap-1 underline underline-offset-4"
              >
                {l.name}
                <ExternalLink className="size-3 shrink-0" aria-hidden />
              </a>
              <span className="text-muted-foreground rounded border px-1.5 text-xs">{s.externalLabel}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
