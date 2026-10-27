import type { Company, Job } from "@prisma/client";
import { FAMILY_LABELS, LEVEL_LABELS, salaryStrings } from "@/lib/i18n/salary";
import type { Locale } from "@/lib/i18n/dictionaries";
import { formatBandK } from "@/lib/salary/estimate";
import { SALARY_FAMILIES, SALARY_LEVELS } from "@/lib/salary/reference";
import { companyBands } from "@/lib/salary/server";
import { cn } from "@/lib/utils";
import { SalaryBandChart } from "./SalaryBandChart";
import { SalaryReportForm } from "./SalaryReportForm";
import { confidenceClass } from "./SalarySection";
import { adjustmentText, SalarySources } from "./SalarySources";

const MAX_ROWS = 12;

export async function CompanySalaryBands({
  company,
  jobs,
  loggedIn,
  locale,
}: {
  company: Company;
  jobs: Job[];
  loggedIn: boolean;
  locale: Locale;
}) {
  const s = salaryStrings(locale);
  const rows = (await companyBands(company, jobs)).slice(0, MAX_ROWS);
  const domain: [number, number] = rows.length
    ? [Math.min(...rows.map((r) => r.estimate.p25)) * 0.9, Math.max(...rows.map((r) => r.estimate.p75)) * 1.05]
    : [0, 1];
  const tier = rows[0]?.estimate.adjustments.find((a) => a.kind === "tier");

  return (
    <section aria-labelledby="company-salary" className="border-rule flex flex-col gap-4 border-t-2 pt-6">
      <div className="flex flex-col gap-1">
        <h2 id="company-salary" className="font-heading text-xl font-bold">
          {s.companyTitle}
        </h2>
        <p className="text-muted-foreground text-sm">{s.companyLead}</p>
        {tier && <p className="text-muted-foreground text-sm">{adjustmentText(tier, s)}</p>}
      </div>

      {rows.length > 0 && (
        <div className="bg-card overflow-hidden rounded-lg border">
          <div className="text-muted-foreground hidden grid-cols-[minmax(0,14rem)_minmax(0,1fr)_7rem_3.5rem] gap-4 border-b px-4 py-2 text-xs font-semibold sm:grid">
            <span>{s.colRole}</span>
            <span />
            <span>{s.colBand}</span>
            <span className="text-end">{s.colOpen}</span>
          </div>
          <ul className="divide-y">
            {rows.map((r) => (
              <li
                key={`${r.family}:${r.level}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_7rem_3.5rem]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{FAMILY_LABELS[locale][r.family]}</p>
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    {LEVEL_LABELS[locale][r.level]}
                    <span
                      className={cn(
                        "rounded-sm px-1.5 text-[0.68rem] font-semibold",
                        confidenceClass(r.estimate.confidence),
                      )}
                    >
                      {s.confidence[r.estimate.confidence]}
                    </span>
                  </p>
                </div>
                <bdi dir="ltr" className="font-mono text-sm font-semibold tabular-nums sm:order-3">
                  {formatBandK(r.estimate)}
                </bdi>
                <div className="col-span-2 sm:order-2 sm:col-span-1">
                  <SalaryBandChart band={r.estimate} domain={domain} s={s} locale={locale} compact />
                </div>
                <span className="text-muted-foreground hidden text-end font-mono text-sm sm:order-4 sm:block">
                  {r.openRoles}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {rows[0] && <SalarySources estimate={rows[0].estimate} s={s} locale={locale} />}

      <details className="bg-card rounded-lg border p-4">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-bold underline-offset-4 hover:underline">
          {s.report.title}
        </summary>
        <p className="text-muted-foreground mb-3 text-sm">{s.report.lead}</p>
        <SalaryReportForm
          companyId={company.id}
          defaultFamily={rows[0]?.family}
          defaultLevel={rows[0]?.level}
          families={SALARY_FAMILIES.map((f) => [f, FAMILY_LABELS[locale][f]])}
          levels={SALARY_LEVELS.map((l) => [l, LEVEL_LABELS[locale][l]])}
          s={s.report}
          loggedIn={loggedIn}
          idPrefix="salary-company"
        />
      </details>
    </section>
  );
}
