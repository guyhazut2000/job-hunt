"use client";

import { Loader2, Save, Sparkles } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { saveLinkedinDraft, suggestLinkedin } from "@/app/cv/linkedin/actions";
import { CopyButton } from "@/components/outreach/CopyButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fillL, type LinkedinProfileStrings } from "@/lib/i18n/linkedin-profile";
import {
  ABOUT_HOOK,
  ABOUT_MAX,
  CHECK_GROUP,
  HEADLINE_MAX,
  MAX_FEATURED,
  evaluateLinkedin,
  recommendationRequestDraft,
  type Check,
  type CheckGroup,
  type LinkedinContext,
  type LinkedinInput,
} from "@/lib/linkedin/profile";
import { cn } from "@/lib/utils";

const GROUPS: CheckGroup[] = ["headline", "about", "experience", "featured", "recommendations", "consistency"];
const TONE: Record<Check["status"], string> = {
  pass: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  warn: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  fail: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  na: "bg-muted text-muted-foreground",
};

export function LinkedinWorkspace({
  s,
  lang,
  ctx,
  initial,
  initialSuggestion,
  myName,
}: {
  s: LinkedinProfileStrings;
  lang: "he" | "en";
  ctx: LinkedinContext;
  initial: LinkedinInput;
  initialSuggestion: { headline: string; about: string; source: "ai" | "template" };
  myName: string | null;
}) {
  const [input, setInput] = useState<LinkedinInput>(initial);
  const [sug, setSug] = useState(initialSuggestion);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "ai" | null>(null);
  const [recName, setRecName] = useState("");
  const [recProject, setRecProject] = useState("");
  const [, start] = useTransition();
  const report = useMemo(() => evaluateLinkedin(input, ctx), [input, ctx]);
  const set = <K extends keyof LinkedinInput>(k: K, v: LinkedinInput[K]) => setInput((p) => ({ ...p, [k]: v }));
  const featured = [...input.featured, ...Array(MAX_FEATURED).fill("")].slice(0, MAX_FEATURED) as string[];

  const save = () =>
    start(async () => {
      setBusy("save");
      setMsg(null);
      try {
        await saveLinkedinDraft(input);
        setMsg(s.saved);
      } catch {
        setMsg(s.error);
      } finally {
        setBusy(null);
      }
    });
  const improve = () =>
    start(async () => {
      setBusy("ai");
      setMsg(null);
      try {
        const r = await suggestLinkedin(input, lang);
        setSug({ headline: r.headline, about: r.about, source: r.source });
        setMsg(r.limited ?? (r.rejected ? s.aiRejected : null));
      } catch {
        setMsg(s.error);
      } finally {
        setBusy(null);
      }
    });

  const text = (c: Check) => {
    const t: { pass: string; warn: string; fail: string; na?: string } = s.checks[c.id];
    const tpl = c.status === "na" ? (t.na ?? "") : t[c.status];
    return fillL(tpl, c.vars);
  };
  const counter = (n: number, max: number) => (
    <span className={cn("text-xs", n > max ? "text-destructive font-bold" : "text-muted-foreground")}>
      {fillL(s.chars, { n, max })}
    </span>
  );
  const hook = input.about.slice(0, ABOUT_HOOK);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <form
        className="bg-card flex min-w-0 flex-col gap-4 rounded-xl border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        data-testid="li-form"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="flex flex-wrap items-baseline justify-between gap-2 font-medium">
            {s.headline}
            {counter(input.headline.length, HEADLINE_MAX)}
          </span>
          <Input dir="auto" value={input.headline} maxLength={600} onChange={(e) => set("headline", e.target.value)} data-testid="li-headline" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="flex flex-wrap items-baseline justify-between gap-2 font-medium">
            {s.about}
            {counter(input.about.length, ABOUT_MAX)}
          </span>
          <Textarea dir="auto" rows={8} value={input.about} maxLength={6000} onChange={(e) => set("about", e.target.value)} data-testid="li-about" />
          {hook && (
            <span className="text-muted-foreground text-xs">
              {fillL(s.hookMark, { n: ABOUT_HOOK })}:{" "}
              <bdi className="text-foreground" dir="auto">
                {hook}
                {input.about.length > ABOUT_HOOK ? "…" : ""}
              </bdi>
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{s.experience}</span>
          <span className="text-muted-foreground text-xs">{s.experienceHint}</span>
          <Textarea dir="auto" rows={8} value={input.experience} maxLength={12000} onChange={(e) => set("experience", e.target.value)} data-testid="li-experience" />
        </label>
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="font-medium">{s.featured}</legend>
          <span className="text-muted-foreground text-xs">{s.featuredHint}</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {featured.map((f, i) => (
              <Input
                key={i}
                dir="ltr"
                type="url"
                inputMode="url"
                placeholder="https://"
                value={f}
                maxLength={300}
                aria-label={`${s.featured} ${i + 1}`}
                onChange={(e) => {
                  const next = [...featured];
                  next[i] = e.target.value;
                  set("featured", next.filter((x, j) => x || j < i).slice(0, MAX_FEATURED));
                }}
                data-testid={`li-featured-${i}`}
              />
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{s.skills}</span>
          <Textarea dir="auto" rows={3} value={input.skills} maxLength={3000} onChange={(e) => set("skills", e.target.value)} data-testid="li-skills" />
        </label>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex flex-col gap-1">
            <span className="font-medium">{s.recsHave}</span>
            <Input type="number" min={0} max={500} className="w-28" value={input.recsHave} onChange={(e) => set("recsHave", Number(e.target.value) || 0)} data-testid="li-recs-have" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">{s.recsGoal}</span>
            <Input type="number" min={0} max={50} className="w-28" value={input.recsGoal} onChange={(e) => set("recsGoal", Number(e.target.value) || 0)} data-testid="li-recs-goal" />
            <span className="text-muted-foreground text-xs">{s.recsGoalHint}</span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy !== null} data-testid="li-save">
            {busy === "save" ? <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden /> : <Save data-icon="inline-start" aria-hidden />}
            {s.save}
          </Button>
          {msg && (
            <span role="status" className="text-sm" data-testid="li-msg">
              {msg}
            </span>
          )}
        </div>
      </form>

      <aside className="flex min-w-0 flex-col gap-3" aria-label={s.score} data-testid="li-report">
        <p className="font-heading text-lg font-bold" data-testid="li-score">
          {fillL(s.score, { passed: report.passed, total: report.total })}
        </p>
        {GROUPS.map((g) => {
          const items = report.checks.filter((c) => CHECK_GROUP[c.id] === g);
          return (
            <section key={g} className="bg-card rounded-lg border p-3">
              <h2 className="mb-2 text-sm font-bold">{s.groups[g]}</h2>
              <ul className="flex flex-col gap-2">
                {items.map((c) => (
                  <li key={c.id} className="flex flex-col gap-0.5 text-sm" data-testid={`li-check-${c.id}`} data-status={c.status}>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", TONE[c.status])}>{s.status[c.status]}</span>
                      <span className="font-medium">{s.checks[c.id].title}</span>
                    </span>
                    <span dir="auto" className="text-muted-foreground text-xs break-words">
                      {text(c)}
                    </span>
                  </li>
                ))}
              </ul>
              {g === "consistency" &&
                (
                  [
                    [s.missingCompanies, report.missing.companies],
                    [s.missingTitles, report.missing.titles],
                    [s.missingSkills, report.missing.skills],
                  ] as const
                ).map(([label, list]) =>
                  list.length ? (
                    <p key={label} className="mt-2 text-xs break-words">
                      <span className="font-medium">{label}: </span>
                      {list.map((x, i) => (
                        <span key={x}>
                          {i > 0 && ", "}
                          <bdi>{x}</bdi>
                        </span>
                      ))}
                    </p>
                  ) : null,
                )}
            </section>
          );
        })}
      </aside>

      <section className="bg-card flex min-w-0 flex-col gap-3 rounded-xl border p-4 lg:col-span-2" data-testid="li-suggest">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-bold">{s.suggest}</h2>
          <span className="bg-muted rounded-full px-2 py-0.5 text-xs font-bold" data-testid="li-suggest-source">
            {sug.source === "ai" ? s.aiBadge : s.ruleBadge}
          </span>
        </div>
        <p className="text-muted-foreground -mt-1 text-sm">{s.suggestLead}</p>
        <div className="flex flex-col gap-1">
          <span className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-medium">
            {s.suggestedHeadline}
            {counter(sug.headline.length, HEADLINE_MAX)}
          </span>
          <Textarea readOnly dir="auto" rows={2} value={sug.headline} data-testid="li-suggest-headline" />
          <div>
            <CopyButton text={sug.headline} label={s.copy} copiedLabel={s.copied} />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-medium">
            {s.suggestedAbout}
            {counter(sug.about.length, ABOUT_MAX)}
          </span>
          <Textarea readOnly dir="auto" rows={10} value={sug.about} data-testid="li-suggest-about" />
          <div>
            <CopyButton text={sug.about} label={s.copy} copiedLabel={s.copied} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" onClick={improve} disabled={busy !== null} data-testid="li-ai">
            {busy === "ai" ? <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden /> : <Sparkles data-icon="inline-start" aria-hidden />}
            {s.suggestAi}
          </Button>
          <span className="text-muted-foreground text-xs">{s.aiNote}</span>
        </div>
      </section>

      <section className="bg-card flex min-w-0 flex-col gap-3 rounded-xl border p-4 lg:col-span-2" data-testid="li-rec">
        <h2 className="font-heading text-lg font-bold">{s.recTitle}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span>{s.recName}</span>
            <Input dir="auto" value={recName} maxLength={80} onChange={(e) => setRecName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{s.recProject}</span>
            <Input dir="auto" value={recProject} maxLength={160} onChange={(e) => setRecProject(e.target.value)} />
          </label>
        </div>
        {(() => {
          const draft = recommendationRequestDraft({ name: recName, myName, project: recProject }, lang);
          return (
            <>
              <Textarea readOnly dir="auto" rows={6} value={draft} data-testid="li-rec-draft" />
              <div>
                <CopyButton text={draft} label={s.copy} copiedLabel={s.copied} />
              </div>
            </>
          );
        })()}
      </section>
    </div>
  );
}
