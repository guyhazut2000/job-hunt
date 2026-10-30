import Link from "next/link";
import { BarChart3, Briefcase, KanbanSquare, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { statsStrings, type StatsStrings } from "@/lib/i18n/stats";
import { DOMAIN_LABELS, isJobDomain } from "@/lib/jobs/domains";
import { requireUser } from "@/lib/session";
import {
  computeStats,
  MIN_FOR_RATES,
  MIN_ROW_FOR_RATE,
  STUCK_DAYS,
  type BreakdownRow,
  type StatsApp,
} from "@/lib/stats/search-stats";
import { cn } from "@/lib/utils";
import { localizedTitle } from "@/lib/i18n/titles";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("stats");

const PROVIDERS: Record<string, string> = {
  GREENHOUSE: "Greenhouse",
  LEVER: "Lever",
  COMEET: "Comeet",
  ASHBY: "Ashby",
  WORKABLE: "Workable",
  SMARTRECRUITERS: "SmartRecruiters",
  WORKDAY: "Workday",
  RECRUITEE: "Recruitee",
  WORDPRESS: "WordPress",
  EIGHTFOLD: "Eightfold",
  ORACLE_HCM: "Oracle Recruiting",
  JIBE: "iCIMS",
  AMAZON: "amazon.jobs",
  SUCCESSFACTORS: "SuccessFactors",
};

const fill = (tpl: string, vars: Record<string, string | number>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

export default async function StatsPage() {
  const user = await requireUser("/stats");
  const locale = await getLocale();
  const s = statsStrings(locale);
  const rows = await db.application.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      title: true,
      company: true,
      status: true,
      createdAt: true,
      appliedAt: true,
      statusChangedAt: true,
      source: true,
      jobId: true,
      job: { select: { domain: true, source: true } },
      statusChanges: {
        select: { fromStatus: true, toStatus: true, source: true, createdAt: true, emailDate: true, undoneAt: true },
      },
    },
    take: 3000,
  });
  const apps: StatsApp[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    company: r.company,
    status: r.status,
    createdAt: r.createdAt,
    appliedAt: r.appliedAt,
    statusChangedAt: r.statusChangedAt,
    source: r.source,
    jobId: r.jobId,
    domain: r.job?.domain ?? null,
    provider: r.job?.source ?? null,
    changes: r.statusChanges.map((c) => ({
      fromStatus: c.fromStatus,
      toStatus: c.toStatus,
      source: c.source,
      at: c.emailDate ?? c.createdAt,
      undone: !!c.undoneAt,
    })),
  }));
  const st = computeStats(apps);
  const nf = new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-US", { maximumFractionDigits: 1 });
  const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
  const days = (x: number | null) => (x === null ? "—" : nf.format(Math.round(x * 10) / 10));
  const domainLabel = (k: string) =>
    isJobDomain(k) ? DOMAIN_LABELS[locale][k] : k === "unknown" ? s.unknownDomain : k;
  const sourceLabel = (k: string) =>
    PROVIDERS[k] ??
    (k === "EMAIL" ? s.sourceEmail : k === "EXTERNAL" ? s.sourceExternal : k === "MANUAL" ? s.sourceManual : k);
  const stepLabel = { applied: s.applied, responded: s.responded, interviewed: s.interviewed, offered: s.offered };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8" data-testid="stats">
      <header className="rule-double flex flex-col gap-2 pb-4">
        <p className="kicker">{s.kicker}</p>
        <h1 className="text-title flex items-center gap-2 font-black">
          <BarChart3 className="text-primary size-7" aria-hidden />
          {s.title}
        </h1>
        <p className="text-muted-foreground max-w-prose leading-relaxed">{s.lead}</p>
      </header>

      {st.counts.applied === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-10 text-center" data-testid="stats-empty">
          <BarChart3 className="text-muted-foreground size-8" aria-hidden />
          <h2 className="font-heading text-lg font-bold">{s.emptyTitle}</h2>
          <p className="text-muted-foreground max-w-sm">{s.emptyBody}</p>
          {st.saved > 0 && (
            <p className="text-sm">
              {s.saved}: <span className="font-mono font-bold">{st.saved}</span>
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/jobs">
                <Briefcase data-icon="inline-start" aria-hidden />
                {s.emptyJobs}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">
                <KanbanSquare data-icon="inline-start" aria-hidden />
                {s.emptyTracker}
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {st.smallData && (
            <p className="bg-caution-soft text-caution rounded-lg px-4 py-3 text-sm" data-testid="stats-small">
              {fill(s.smallData, { n: st.counts.applied, min: MIN_FOR_RATES })}
            </p>
          )}

          <section aria-label={s.responseRate} className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label={s.responseRate} value={pct(st.rates.response)} hint={s.responseHint} testid="kpi-response" />
            <Kpi label={s.interviewRate} value={pct(st.rates.interview)} />
            <Kpi label={s.rejectionRate} value={pct(st.rates.rejection)} />
            <Kpi
              label={s.ttr}
              value={st.timeToResponse.medianDays === null ? "—" : days(st.timeToResponse.medianDays)}
              hint={
                st.timeToResponse.n
                  ? fill(s.ttrRange, {
                      a: days(st.timeToResponse.fastestDays),
                      b: days(st.timeToResponse.slowestDays),
                      n: st.timeToResponse.n,
                    })
                  : s.ttrNone
              }
              testid="kpi-ttr"
            />
          </section>

          <section aria-labelledby="funnel-h" className="flex flex-col gap-3">
            <h2 id="funnel-h" className="font-heading text-xl font-bold">
              {s.funnel}
            </h2>
            <ol className="card flex flex-col gap-3" data-testid="stats-funnel">
              {(["applied", "responded", "interviewed", "offered"] as const).map((k, i) => {
                const n = st.counts[k];
                const width = st.counts.applied ? Math.max(2, (n / st.counts.applied) * 100) : 0;
                const step = i > 0 ? st.steps[i - 1] : null;
                return (
                  <li key={k} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-semibold">{stepLabel[k]}</span>
                      <span className="text-muted-foreground">
                        <span className="text-foreground font-mono text-base font-bold">{n}</span>
                        {i > 0 && !st.smallData && (
                          <span className="ms-2">{fill(s.ofApplied, { p: pct(n / st.counts.applied) })}</span>
                        )}
                        {step?.rate != null && (
                          <span className="ms-2">· {fill(s.stepRate, { p: pct(step.rate) })}</span>
                        )}
                      </span>
                    </div>
                    <div className="bg-muted h-3 overflow-hidden rounded-full">
                      <div
                        className={cn("h-full rounded-full", i === 3 ? "bg-fit" : "bg-primary")}
                        style={{ width: `${width}%`, opacity: 1 - i * 0.15 }}
                      />
                    </div>
                  </li>
                );
              })}
              <li className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-sm">
                <span>
                  {s.rejected}: <span className="text-foreground font-mono font-bold">{st.counts.rejected}</span>
                </span>
                <span>
                  {s.active}: <span className="text-foreground font-mono font-bold">{st.active}</span>
                </span>
                <span>
                  {s.saved}: <span className="text-foreground font-mono font-bold">{st.saved}</span>
                </span>
              </li>
            </ol>
          </section>

          <section aria-labelledby="stuck-h" className="flex flex-col gap-3" data-testid="stats-stuck">
            <h2 id="stuck-h" className="font-heading text-xl font-bold">
              {s.stuckTitle}
            </h2>
            <div className="card flex flex-col gap-4">
              <p className="font-medium">
                {st.bottleneck
                  ? fill(s.bottleneck, {
                      from: stepLabel[st.bottleneck.from],
                      to: stepLabel[st.bottleneck.to],
                      p: pct(st.bottleneck.rate),
                    })
                  : s.noBottleneck}
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                {st.waits.map((w) => (
                  <li key={w.stage} className="flex flex-wrap gap-x-2">
                    {w.count
                      ? fill(s.waitStage, { stage: s.stage[w.stage], count: w.count, d: days(w.medianDays) })
                      : `${s.stage[w.stage]}: ${s.waitNone}`}
                    {w.stuck > 0 && (
                      <span className="bg-caution-soft text-caution rounded-full px-2 font-mono text-xs leading-5 font-bold">
                        {fill(s.waitStuck, { n: w.stuck, days: STUCK_DAYS[w.stage] })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {st.stuck.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-bold">{s.stuckList}</h3>
                  <ul className="divide-y rounded-lg border">
                    {st.stuck.map((x) => (
                      <li key={x.id}>
                        <Link
                          href={x.jobId ? `/jobs/${x.jobId}` : "/dashboard"}
                          className="hover:bg-muted/50 flex items-center justify-between gap-3 px-3 py-2 text-sm"
                        >
                          <span className="min-w-0 truncate">
                            <span className="font-semibold">{x.title}</span>
                            <span className="text-muted-foreground"> · {x.company}</span>
                          </span>
                          <span className="text-muted-foreground shrink-0">
                            {s.stage[x.status]} · {fill(s.stuckDays, { d: x.days })}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-bold">{s.rejectedAtTitle}</h3>
                {st.counts.rejected ? (
                  <p className="text-muted-foreground flex flex-wrap gap-x-4 text-sm">
                    {(["APPLIED", "SCREENING", "INTERVIEW", "OFFER"] as const)
                      .filter((k) => st.rejectedAt[k])
                      .map((k) => (
                        <span key={k}>
                          {s.stage[k]}: <span className="text-foreground font-mono font-bold">{st.rejectedAt[k]}</span>
                        </span>
                      ))}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">{s.rejectedAtNone}</p>
                )}
              </div>
            </div>
          </section>

          <Trend s={s} trend={st.trend} locale={locale} />

          <div className="grid gap-6 lg:grid-cols-2">
            <Breakdown title={s.byCompany} rows={st.byCompany} label={(k) => k} s={s} testid="by-company" />
            <Breakdown title={s.byDomain} rows={st.byDomain} label={domainLabel} s={s} testid="by-domain" />
            <Breakdown title={s.bySource} rows={st.bySource} label={sourceLabel} s={s} testid="by-source" />
            <section aria-labelledby="email-h" className="flex flex-col gap-3" data-testid="stats-email">
              <h2 id="email-h" className="font-heading text-xl font-bold">
                {s.emailTitle}
              </h2>
              <div className="card flex flex-col gap-3 text-sm leading-relaxed">
                <p>
                  {st.email.autoChanges + st.email.reviewChanges + st.email.undone
                    ? fill(s.emailBody, {
                        auto: st.email.autoChanges,
                        review: st.email.reviewChanges,
                        undone: st.email.undone,
                        resp: st.email.responsesFromEmail,
                      })
                    : s.emailNone}
                </p>
                <Button asChild variant="outline" size="sm" className="self-start">
                  <Link href="/settings/email">
                    <MailCheck data-icon="inline-start" aria-hidden />
                    {s.emailSettings}
                  </Link>
                </Button>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint, testid }: { label: string; value: string; hint?: string; testid?: string }) {
  return (
    <div className="card flex flex-col gap-1" data-testid={testid}>
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="font-mono text-2xl font-bold">{value}</span>
      {hint && <span className="text-muted-foreground text-xs leading-snug">{hint}</span>}
    </div>
  );
}

function Breakdown({
  title,
  rows,
  label,
  s,
  testid,
}: {
  title: string;
  rows: BreakdownRow[];
  label: (k: string) => string;
  s: StatsStrings;
  testid: string;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3" data-testid={testid}>
      <h2 className="font-heading text-xl font-bold">{title}</h2>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-xs">
            <tr className="border-b">
              <th className="px-3 py-2 text-start font-medium">{s.colKey}</th>
              <th className="px-2 py-2 text-end font-medium">{s.colApplied}</th>
              <th className="px-2 py-2 text-end font-medium">{s.colResponded}</th>
              <th className="px-2 py-2 text-end font-medium">{s.colInterviewed}</th>
              <th className="px-3 py-2 text-end font-medium" title={fill(s.rateHidden, { n: MIN_ROW_FOR_RATE })}>
                {s.colRate}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="max-w-48 truncate px-3 py-2 font-medium">{label(r.key)}</td>
                <td className="px-2 py-2 text-end font-mono">{r.applied}</td>
                <td className="px-2 py-2 text-end font-mono">{r.responded}</td>
                <td className="px-2 py-2 text-end font-mono">{r.interviewed}</td>
                <td className="text-muted-foreground px-3 py-2 text-end font-mono">
                  {r.responseRate === null ? "—" : `${Math.round(r.responseRate * 100)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-xs">{fill(s.rateHidden, { n: MIN_ROW_FOR_RATE })}</p>
    </section>
  );
}

function Trend({
  s,
  trend,
  locale,
}: {
  s: StatsStrings;
  trend: { week: string; applied: number; responded: number; interviewed: number; rejected: number }[];
  locale: string;
}) {
  const max = Math.max(1, ...trend.map((w) => Math.max(w.applied, w.responded)));
  const fmt = (w: string) =>
    new Date(`${w}T12:00:00Z`).toLocaleDateString(locale === "he" ? "he-IL" : "en-GB", {
      day: "numeric",
      month: "numeric",
      timeZone: "Asia/Jerusalem",
    });
  return (
    <section aria-labelledby="trend-h" className="flex flex-col gap-3" data-testid="stats-trend">
      <h2 id="trend-h" className="font-heading text-xl font-bold">
        {s.trend}
      </h2>
      <div className="card flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">{s.trendHint}</p>
        <div className="flex h-36 items-end gap-1 sm:gap-2" aria-hidden>
          {trend.map((w) => (
            <div
              key={w.week}
              className="flex h-full min-w-0 flex-1 flex-col justify-end"
              title={`${fill(s.weekOf, { d: fmt(w.week) })}: ${s.colApplied} ${w.applied} · ${s.colResponded} ${w.responded} · ${s.colInterviewed} ${w.interviewed} · ${s.rejected} ${w.rejected}`}
            >
              <div className="flex h-full items-end justify-center gap-px">
                <div className="bg-primary w-1/2 rounded-t" style={{ height: `${(w.applied / max) * 100}%` }} />
                <div className="bg-fit w-1/2 rounded-t" style={{ height: `${(w.responded / max) * 100}%` }} />
              </div>
              <span className="text-muted-foreground mt-1 truncate text-center text-[10px]">{fmt(w.week)}</span>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground flex gap-4 text-xs">
          <span className="flex items-center gap-1">
            <span className="bg-primary inline-block size-2.5 rounded-sm" /> {s.colApplied}
          </span>
          <span className="flex items-center gap-1">
            <span className="bg-fit inline-block size-2.5 rounded-sm" /> {s.colResponded}
          </span>
        </p>
        <table className="sr-only">
          <caption>{s.trend}</caption>
          <thead>
            <tr>
              <th>{s.weekOf.replace(" {d}", "")}</th>
              <th>{s.colApplied}</th>
              <th>{s.colResponded}</th>
              <th>{s.colInterviewed}</th>
              <th>{s.rejected}</th>
            </tr>
          </thead>
          <tbody>
            {trend.map((w) => (
              <tr key={w.week}>
                <td>{fmt(w.week)}</td>
                <td>{w.applied}</td>
                <td>{w.responded}</td>
                <td>{w.interviewed}</td>
                <td>{w.rejected}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
