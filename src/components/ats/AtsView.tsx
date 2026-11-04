"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { checkPastedJob } from "@/app/cv/ats/actions";
import { ShowMoreList } from "@/components/density/ShowMoreList";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { AtsGroup, AtsRule, AtsStatus } from "@/lib/ats/check";
import type { AtsJobOption, AtsRun } from "@/lib/ats/server";
import { ATS_RULE_SOURCES, ATS_SOURCES, getAtsStrings } from "@/lib/i18n/ats";
import { densityStrings, fillD } from "@/lib/i18n/density";
import type { Locale } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

const TONE: Record<AtsStatus, string> = {
  pass: "bg-fit-soft text-fit",
  warn: "bg-caution-soft text-caution",
  fail: "bg-destructive/10 text-destructive",
  pending: "bg-muted text-muted-foreground",
  na: "bg-muted text-muted-foreground",
};
const GROUPS: AtsGroup[] = ["parse", "match", "content"];
const ITEMS_SHOWN = 8;

function Items({ items, more }: { items: string[]; more: string }) {
  if (!items.length) return null;
  const shown = items.slice(0, ITEMS_SHOWN);
  return (
    <p className="text-sm break-words">
      {shown.map((x, i) => (
        <span key={`${x}-${i}`}>
          {i > 0 && " · "}
          <bdi>{x}</bdi>
        </span>
      ))}
      {items.length > ITEMS_SHOWN && (
        <span className="text-muted-foreground"> {fillD(more, { n: items.length - ITEMS_SHOWN })}</span>
      )}
    </p>
  );
}

function RuleCard({ r, locale }: { r: AtsRule; locale: Locale }) {
  const t = getAtsStrings(locale);
  const rt = t.rules[r.id];
  const detail =
    r.status === "pending"
      ? t.pending
      : r.status === "na"
        ? t.na
        : fillD(r.status === "pass" ? rt.pass : rt.issue, r.params);
  return (
    <li className="bg-card rounded-xl border p-4" data-testid={`ats-rule-${r.id}`} data-status={r.status}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">{rt.name}</h3>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", TONE[r.status])}>
          {t.status[r.status]}
        </span>
      </div>
      <p className="mt-1 text-sm">{detail}</p>
      {r.status !== "pass" && r.status !== "na" && <Items items={r.items} more={t.more} />}
      {(r.status === "warn" || r.status === "fail") && (
        <p className="mt-2 text-sm">
          <span className="font-semibold">{t.fix}: </span>
          {rt.fix}
        </p>
      )}
      <details className="mt-2 text-sm">
        <summary className="text-muted-foreground cursor-pointer">{t.why}</summary>
        <p className="mt-1 leading-relaxed">{rt.why}</p>
        <p className="mt-1 flex flex-wrap gap-x-3">
          {ATS_RULE_SOURCES[r.id].map((k) => (
            <a key={k} href={ATS_SOURCES[k].url} target="_blank" rel="noreferrer" className="text-primary underline">
              <bdi>{ATS_SOURCES[k].label}</bdi>
            </a>
          ))}
        </p>
      </details>
    </li>
  );
}

export function AtsView({
  locale,
  initial,
  jobs,
  jobId,
  template,
}: {
  locale: Locale;
  initial: AtsRun;
  jobs: AtsJobOption[];
  jobId: string | null;
  template: string | null;
}) {
  const t = getAtsStrings(locale);
  const ds = densityStrings(locale);
  const router = useRouter();
  const [run, setRun] = useState(initial);
  const [jd, setJd] = useState("");
  const [jdTitle, setJdTitle] = useState("");
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const report = run.report;
  if (!report) return null;

  const pickJob = (id: string) => {
    const q = new URLSearchParams();
    if (id) q.set("job", id);
    if (template) q.set("template", template);
    router.push(`/cv/ats${q.size ? `?${q}` : ""}`, { scroll: false });
  };
  const onPaste = () =>
    start(async () => {
      setError(false);
      const r = await checkPastedJob({ title: jdTitle, text: jd, template });
      if (r.ok) setRun(r.run);
      else setError(true);
    });

  const missing = report.keywords.filter((k) => !k.found);
  const have = report.keywords.filter((k) => k.found);

  return (
    <div className="flex flex-col gap-6">
      <section
        className="bg-card flex flex-wrap items-center gap-4 rounded-xl border p-4 sm:p-5"
        data-testid="ats-score"
      >
        <div className="flex flex-col">
          <span className="kicker">{t.score}</span>
          <span className="text-4xl font-black tabular-nums">{report.score}</span>
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <p className="text-muted-foreground">{t.scoreHint}</p>
          <p className="mt-1">
            {t.template}: <bdi>{run.template}</bdi> · {run.columns === 2 ? t.twoColumns : t.oneColumn}
          </p>
          {run.job && <p className="mt-1 font-semibold">{fillD(t.jobAgainst, { title: run.job.title || "—" })}</p>}
        </div>
      </section>
      {run.renderError && (
        <p role="alert" className="bg-caution-soft text-caution rounded-md border p-3 text-sm">
          {t.renderError}
        </p>
      )}

      <section className="bg-card flex flex-col gap-3 rounded-xl border p-4 sm:p-5" data-testid="ats-job">
        <h2 className="text-lg font-black">{t.jobTitle}</h2>
        <p className="text-muted-foreground text-sm">{t.jobLead}</p>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t.jobPick}
          <select
            className="bg-background min-h-11 w-full max-w-full rounded-md border px-3 text-sm font-normal"
            value={jobId ?? ""}
            onChange={(e) => pickJob(e.target.value)}
            data-testid="ats-job-select"
          >
            <option value="">{t.jobNone}</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} · {j.company}
              </option>
            ))}
          </select>
        </label>
        <details>
          <summary className="cursor-pointer text-sm font-semibold">{t.jobPaste}</summary>
          <div className="mt-2 flex flex-col gap-2">
            <Input
              value={jdTitle}
              onChange={(e) => setJdTitle(e.target.value)}
              placeholder={t.jobPasteTitle}
              maxLength={200}
            />
            <Textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder={t.jobPastePh}
              rows={6}
              maxLength={12000}
              data-testid="ats-jd"
            />
            <Button type="button" onClick={onPaste} disabled={pending || jd.trim().length < 20} className="self-start">
              {pending ? t.checking : t.jobCheck}
            </Button>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {t.checkError}
              </p>
            )}
          </div>
        </details>
        {report.keywords.length > 0 && (
          <div className="flex flex-col gap-2" data-testid="ats-keywords">
            <h3 className="font-bold">{t.keywords}</h3>
            <p className="text-muted-foreground text-xs">{t.keywordsHint}</p>
            <ul className="flex flex-wrap gap-1.5">
              {[...missing, ...have].map((k) => (
                <li
                  key={k.keyword}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                    k.found ? "bg-fit-soft text-fit" : "bg-destructive/10 text-destructive",
                  )}
                >
                  <span className="sr-only">{k.found ? t.found : t.missing}: </span>
                  <bdi>{k.keyword}</bdi>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {GROUPS.map((g) => {
        const rules = report.rules.filter((r) => r.group === g);
        return (
          <section key={g} className="flex flex-col gap-3" data-testid={`ats-group-${g}`}>
            <h2 className="text-lg font-black">{t.groups[g]}</h2>
            <ShowMoreList initial={6} s={ds} className="flex flex-col gap-3" label={t.groups[g]}>
              {rules.map((r) => (
                <RuleCard key={r.id} r={r} locale={locale} />
              ))}
            </ShowMoreList>
          </section>
        );
      })}

      {report.buzzwords.length > 0 && (
        <section className="bg-card flex flex-col gap-2 rounded-xl border p-4 sm:p-5" data-testid="ats-buzzwords">
          <h2 className="text-lg font-black">{t.buzzTitle}</h2>
          <p className="text-muted-foreground text-xs">{t.buzzNote}</p>
          <ShowMoreList initial={10} s={ds} className="flex flex-col gap-1 text-sm">
            {report.buzzwords.map((b) => (
              <li key={b.word} className="flex flex-wrap gap-2">
                <bdi className="font-semibold">{b.word}</bdi>
                <span className="text-muted-foreground">
                  ×{b.count} · {b.kind === "llm" ? t.buzzLlm : t.buzzCliche}
                </span>
              </li>
            ))}
          </ShowMoreList>
        </section>
      )}
    </div>
  );
}
