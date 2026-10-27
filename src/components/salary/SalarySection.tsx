import type { Company, Job, Profile } from "@prisma/client";
import { FAMILY_LABELS, LEVEL_LABELS, salaryStrings } from "@/lib/i18n/salary";
import type { Locale } from "@/lib/i18n/dictionaries";
import { askFor, formatIls } from "@/lib/salary/estimate";
import { SALARY_FAMILIES, SALARY_LEVELS } from "@/lib/salary/reference";
import { estimateForJob } from "@/lib/salary/server";
import { cn } from "@/lib/utils";
import { SalaryBandChart } from "./SalaryBandChart";
import { SalaryReportForm } from "./SalaryReportForm";
import { adjustmentText, SalarySources } from "./SalarySources";

export function confidenceClass(c: "high" | "medium" | "low") {
  return c === "high"
    ? "bg-fit-soft text-fit"
    : c === "medium"
      ? "bg-muted text-foreground/80"
      : "bg-caution-soft text-caution";
}

export async function SalarySection({
  job,
  company,
  profile,
  loggedIn,
  locale,
}: {
  job: Job;
  company: Company;
  profile: Profile | null;
  loggedIn: boolean;
  locale: Locale;
}) {
  const s = salaryStrings(locale);
  const est = await estimateForJob(job, company);
  const ask = askFor(est, profile);
  const hasYears = profile?.yearsExperience != null;
  const want = profile?.salaryMin ? formatIls(profile.salaryMin, locale) : "";

  return (
    <section aria-labelledby="salary" className="bg-card flex flex-col gap-4 rounded-lg border p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="salary" className="kicker">
          {s.sectionTitle}
        </h2>
        <span className={cn("rounded-sm px-2 py-0.5 text-xs font-semibold", confidenceClass(est.confidence))}>
          {s.confidence[est.confidence]}
        </span>
      </div>

      <div>
        <p className="font-heading text-2xl font-black tabular-nums sm:text-3xl">
          <bdi dir="ltr">
            {formatIls(est.p25, locale)}–{formatIls(est.p75, locale)}
          </bdi>
        </p>
        <p className="text-muted-foreground text-sm">
          {s.monthlyGross} · {est.isEstimate ? s.chipEstimate : s.chipPosted}
        </p>
      </div>

      <SalaryBandChart band={est} ask={{ low: ask.askLow, high: ask.askHigh }} s={s} locale={locale} />

      <div className="text-foreground/85 flex flex-col gap-1 text-sm">
        <p>{s.basis[est.basis]}</p>
        {est.adjustments.map((a, i) => {
          const text = adjustmentText(a, s);
          return text ? (
            <p key={i} className="text-muted-foreground">
              {text}
            </p>
          ) : null;
        })}
        {est.postedForeign && (
          <p className="text-muted-foreground">{s.foreignPosted.replace("{raw}", est.postedForeign.raw)}</p>
        )}
      </div>

      <div className="border-fit/40 bg-fit-soft/40 flex flex-col gap-2 rounded-md border border-dashed p-3">
        <h3 className="text-sm font-bold">{s.ask.title}</h3>
        <p className="text-lg font-bold tabular-nums">
          <span className="text-muted-foreground me-2 text-sm font-semibold">{s.ask.range}</span>
          <bdi dir="ltr">
            {formatIls(ask.askLow, locale)}–{formatIls(ask.askHigh, locale)}
          </bdi>
        </p>
        <ul className="text-foreground/85 flex list-disc flex-col gap-1 ps-5 text-sm">
          {hasYears ? <li>{s.ask.position[ask.position]}</li> : <li>{s.ask.noProfile}</li>}
          {ask.expectation && <li>{s.ask.expectation[ask.expectation].replace("{want}", want)}</li>}
          {ask.levelGap > 0 && <li>{s.ask.levelUp}</li>}
          {ask.levelGap < 0 && <li>{s.ask.levelDown}</li>}
          <li>{s.ask.tip}</li>
        </ul>
        {loggedIn && !hasYears && (
          <a
            href="/profile"
            className="text-foreground inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          >
            {s.ask.completeProfile}
          </a>
        )}
      </div>

      <SalarySources estimate={est} s={s} locale={locale} />

      <details className="border-t pt-2">
        <summary className="text-foreground/85 inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold underline-offset-4 hover:underline">
          {s.report.title}
        </summary>
        <p className="text-muted-foreground mb-3 text-sm">{s.report.lead}</p>
        <SalaryReportForm
          companyId={company.id}
          defaultFamily={est.family}
          defaultLevel={est.level}
          families={SALARY_FAMILIES.map((f) => [f, FAMILY_LABELS[locale][f]])}
          levels={SALARY_LEVELS.map((l) => [l, LEVEL_LABELS[locale][l]])}
          s={s.report}
          loggedIn={loggedIn}
          idPrefix={`salary-${job.id}`}
        />
      </details>
    </section>
  );
}
