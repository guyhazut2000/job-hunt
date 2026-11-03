import Link from "next/link";
import { ArrowLeft, ArrowRight, Compass, Sparkles } from "lucide-react";
import { RefreshCoach } from "@/components/coach/RefreshCoach";
import { Button } from "@/components/ui/button";
import type { CoachAi } from "@/lib/coach/ai";
import { coachIsEmpty, lastWeek, OUTREACH_WAIT_DAYS, type CoachData } from "@/lib/coach/build";
import { collectCoachData } from "@/lib/coach/collect";
import { recText } from "@/lib/coach/text";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { coachStrings } from "@/lib/i18n/coach";
import { fill } from "@/lib/i18n/notifications";
import { localizedTitle } from "@/lib/i18n/titles";
import { requireUser } from "@/lib/session";
import { weekStart } from "@/lib/stats/search-stats";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("coach");

const isCoachData = (x: unknown): x is CoachData =>
  !!x && typeof x === "object" && (x as CoachData).version === 1 && Array.isArray((x as CoachData).recommendations);

function parseAi(x: unknown): CoachAi | null {
  if (!x || typeof x !== "object") return null;
  const a = x as CoachAi;
  return typeof a.summary === "string" && a.recs && typeof a.recs === "object" ? a : null;
}

export default async function CoachPage() {
  const user = await requireUser("/coach");
  const locale = await getLocale();
  const s = coachStrings(locale);
  const now = new Date();
  const week = lastWeek(now);
  const [stored, current] = await Promise.all([
    db.coachReport.findUnique({
      where: { userId_week: { userId: user.id, week } },
      select: { data: true, ai: true, aiSource: true, updatedAt: true },
    }),
    collectCoachData(user.id, now, weekStart(now)),
  ]);
  const fromDb = stored && isCoachData(stored.data) ? stored.data : null;
  const data = fromDb ?? (await collectCoachData(user.id, now, week));
  const ai = fromDb ? parseAi(stored?.ai) : null;
  const source = fromDb ? (stored?.aiSource ?? "offline") : "offline";
  const dir = locale === "he" ? "rtl" : "ltr";
  const Arrow = dir === "rtl" ? ArrowLeft : ArrowRight;
  const tag = locale === "he" ? "he-IL" : "en-US";
  const shortDay = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString(tag, { day: "numeric", month: "numeric", timeZone: "UTC" });
  const when = (d: Date) =>
    d.toLocaleString(tag, { timeZone: "Asia/Jerusalem", weekday: "short", hour: "2-digit", minute: "2-digit" });
  const stage = (k: string) => s.stage[k] ?? k;
  const step = (k: string) => s.step[k] ?? k;
  const basisValue = (k: string, v: string | number) =>
    k === "stage" ? stage(String(v)) : k === "from" || k === "to" ? step(String(v)) : k === "rate" ? `${v}%` : v;

  const header = (
    <header className="rule-double flex flex-col gap-2 pb-4">
      <p className="kicker">{s.kicker}</p>
      <h1 className="text-title flex items-center gap-2 font-black">
        <Compass className="text-primary size-7" aria-hidden />
        {s.title}
      </h1>
      <p className="text-muted-foreground max-w-prose leading-relaxed">{s.lead}</p>
    </header>
  );

  if (coachIsEmpty(data)) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6" data-testid="coach">
        {header}
        <div className="card flex flex-col items-center gap-3 py-10 text-center" data-testid="coach-empty">
          <Compass className="text-muted-foreground size-8" aria-hidden />
          <h2 className="font-heading text-lg font-bold">{s.emptyTitle}</h2>
          <p className="text-muted-foreground max-w-sm">{s.emptyBody}</p>
          <Button asChild>
            <Link href="/jobs?sort=personal">{s.emptyCta}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const badge = source === "ai" && ai ? s.aiBadge : source === "limited" ? s.limitedBadge : s.offlineBadge;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8" data-testid="coach">
      {header}

      <section className="flex flex-col gap-3" aria-labelledby="coach-week">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="coach-week" className="font-heading text-xl font-bold" data-testid="coach-week">
            {fill(s.weekOf, { from: shortDay(data.week), to: shortDay(data.weekEnd) })}
          </h2>
          <RefreshCoach labels={{ label: s.regenerate, pending: s.regenerating, ok: s.regenerated, failed: s.failed }} />
        </div>
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1" data-testid="coach-source">
            {source === "ai" && ai ? <Sparkles className="size-4" aria-hidden /> : null}
            {badge}
          </span>
          {stored && fromDb ? <span>{fill(s.generatedAt, { at: when(stored.updatedAt) })}</span> : null}
        </p>
        {!fromDb ? (
          <p className="bg-muted rounded-md px-3 py-2 text-sm" data-testid="coach-preview">
            {s.previewNote}
          </p>
        ) : null}
        {ai?.summary ? <p className="leading-relaxed">{ai.summary}</p> : null}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="coach-recs">
        <h2 id="coach-recs" className="font-heading text-lg font-bold">
          {s.recsTitle}
        </h2>
        <ol className="flex flex-col gap-3">
          {data.recommendations.map((r, i) => {
            const text = ai?.recs?.[r.id] ?? recText(locale, r);
            const basis = Object.entries(r.basis);
            return (
              <li key={r.id} className="card flex flex-col gap-2 p-4" data-testid="coach-rec" data-rec={r.id}>
                <div className="flex items-start gap-3">
                  <span className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold">
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="font-semibold">{text.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{text.detail}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 ps-10">
                  {basis.length ? (
                    <p className="text-xs" data-testid="coach-basis">
                      <span className="text-muted-foreground">{s.basis}: </span>
                      {basis.map(([k, v], j) => (
                        <span key={k}>
                          {j ? " · " : ""}
                          {s.basisLabel[k] ?? k}{" "}
                          <bdi className="font-mono font-semibold">{basisValue(k, v)}</bdi>
                        </span>
                      ))}
                    </p>
                  ) : (
                    <span />
                  )}
                  <Button asChild size="sm" variant="ghost">
                    <Link href={r.href}>
                      {s.open}
                      <Arrow data-icon="inline-end" aria-hidden />
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="coach-numbers" data-testid="coach-numbers">
        <h2 id="coach-numbers" className="font-heading text-lg font-bold">
          {s.numbersTitle}
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={s.applied} value={data.activity.applied} hint={fill(s.prevApplied, { n: data.prevWeek.applied })} testid="coach-applied" />
          <Stat label={s.responses} value={data.activity.responses} />
          <Stat label={s.interviews} value={data.activity.interviews} />
          <Stat label={s.rejections} value={data.activity.rejections} />
        </dl>
        <div className="card flex flex-col gap-3 p-4 text-sm">
          <Row label={s.responseRate}>
            {data.responseRate === null ? (
              fill(s.responseRateSmall, { min: data.minForRates })
            ) : (
              <>
                <bdi className="font-mono font-semibold">{Math.round(data.responseRate * 100)}%</bdi>{" "}
                <span className="text-muted-foreground">
                  ({fill(s.responseRateOf, { responded: data.totals.responded, applied: data.totals.applied })})
                </span>
              </>
            )}
          </Row>
          <Row label={s.bottleneck}>
            {data.bottleneck && data.bottleneck.rate !== null
              ? fill(s.bottleneckLine, {
                  from: step(data.bottleneck.from),
                  to: step(data.bottleneck.to),
                  rate: Math.round(data.bottleneck.rate * 100),
                })
              : s.bottleneckNone}
          </Row>
          <Row label={s.stuckTitle}>
            {data.stuck.total && data.stuck.topStage ? (
              <div className="flex flex-col gap-1">
                <span>{fill(s.stuckLine, { count: data.stuck.total, stage: stage(data.stuck.topStage) })}</span>
                <ul className="text-muted-foreground flex flex-col gap-0.5">
                  {data.stuck.top.map((t, i) => (
                    <li key={i}>
                      <bdi>{t.title}</bdi> · <bdi>{t.company}</bdi>: {fill(s.stuckDays, { days: t.days, stage: stage(t.status) })}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              s.stuckNone
            )}
          </Row>
          <Row label={s.outreach}>
            <div className="flex flex-col gap-0.5">
              <span data-testid="coach-outreach">{fill(s.outreachLine, data.outreach)}</span>
              {data.outreach.waiting ? (
                <span className="text-muted-foreground">
                  {fill(s.outreachWaiting, { n: data.outreach.waiting, days: OUTREACH_WAIT_DAYS })}
                </span>
              ) : null}
            </div>
          </Row>
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="coach-now" data-testid="coach-this-week">
        <h2 id="coach-now" className="font-heading text-lg font-bold">
          {s.thisWeekTitle}
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={s.applied} value={current.activity.applied} />
          <Stat label={s.responses} value={current.activity.responses} />
          <Stat label={s.interviews} value={current.activity.interviews} />
          <Stat label={s.outreach} value={current.outreach.sent} />
        </dl>
      </section>
    </div>
  );
}

function Stat({ label, value, hint, testid }: { label: string; value: number; hint?: string; testid?: string }) {
  return (
    <div className="card flex flex-col gap-0.5 p-3" data-testid={testid}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-mono text-2xl font-bold">{value}</dd>
      {hint ? <dd className="text-muted-foreground text-xs">{hint}</dd> : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
      <span className="text-muted-foreground shrink-0 font-semibold sm:w-40">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
