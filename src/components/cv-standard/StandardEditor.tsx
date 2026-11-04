"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Check, CircleAlert, FileText, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import type { CheckView } from "@/app/cv/standard/view";
import { improveAction, recheckAction, saveStandardAction } from "@/app/cv/standard/actions";
import { CvPreview } from "@/components/cv-templates/CvPreview";
import { ScaledSheet } from "@/components/cv-templates/ScaledSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import { applyDraft, type Draft } from "@/lib/cv-standard/draft";
import type { ImproveResult } from "@/lib/cv-standard/improve";
import {
  bulletFeedback,
  evaluateStandard,
  wordCount,
  type RuleResult,
  type StandardSection,
} from "@/lib/cv-standard/rules";
import type { CvContent } from "@/lib/cv-templates/content";
import type { LayoutEntry } from "@/lib/cv-templates/sections";
import { TEMPLATES, TEMPLATE_IDS, type TemplateId } from "@/lib/cv-templates/templates";
import { cvStandardStrings, fillS } from "@/lib/i18n/cv-standard";
import { SKILL_CATEGORIES } from "@/lib/profile/schema";
import { cn } from "@/lib/utils";

const STEPS: StandardSection[] = ["contact", "summary", "experience", "projects", "education", "skills", "page"];

export interface EntryInfo {
  title: string;
  org: string;
  period: string;
}

export function StandardEditor({
  locale,
  from,
  email,
  initialDraft,
  initialCheck,
  baseContent,
  layouts,
  experience,
  projects,
  education,
  yearsExperience,
  templateNames,
}: {
  locale: "he" | "en";
  from: string | null;
  email: string | null;
  initialDraft: Draft;
  initialCheck: CheckView;
  baseContent: CvContent;
  layouts: Record<TemplateId, LayoutEntry[]>;
  experience: EntryInfo[];
  projects: EntryInfo[];
  education: EntryInfo[];
  yearsExperience: number | null;
  templateNames: Record<TemplateId, string>;
}) {
  const t = cvStandardStrings(locale);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [check, setCheck] = useState<CheckView>(initialCheck);
  const [savedDraft, setSavedDraft] = useState(JSON.stringify(initialDraft));
  const [step, setStep] = useState<StandardSection>(() => {
    const first = initialCheck.results.find((r) => r.severity === "blocking" && r.status === "fail");
    return first?.section ?? "contact";
  });
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, startSave] = useTransition();
  const [rechecking, startRecheck] = useTransition();
  const dirty = JSON.stringify(draft) !== savedDraft;

  // Live rules on the draft; the page check comes from the last real-PDF check (pending when dirty).
  const content = useMemo(() => applyDraft(baseContent, draft, email), [baseContent, draft, email]);
  const live = useMemo(
    () =>
      evaluateStandard({
        content,
        template: check.template,
        skillCategories: draft.skills.map((s) => s.category),
        yearsExperience,
        fit: dirty ? null : { pages: check.pages, level: check.level, fits: check.fits },
      }),
    [content, check, draft.skills, yearsExperience, dirty],
  );
  const failed = (s?: StandardSection) => live.results.filter((r) => r.status === "fail" && (!s || r.section === s));
  const blockingCount = live.blocking.length;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setBullet = (sec: "experience" | "projects", i: number, b: number, v: string) =>
    setDraft((d) => ({
      ...d,
      [sec]: d[sec].map((e, ei) => (ei === i ? { bullets: e.bullets.map((x, bi) => (bi === b ? v : x)) } : e)),
    }));
  const addBullet = (sec: "experience" | "projects", i: number) =>
    setDraft((d) => ({ ...d, [sec]: d[sec].map((e, ei) => (ei === i ? { bullets: [...e.bullets, ""] } : e)) }));
  const removeBullet = (sec: "experience" | "projects", i: number, b: number) =>
    setDraft((d) => ({
      ...d,
      [sec]: d[sec].map((e, ei) => (ei === i ? { bullets: e.bullets.filter((_, bi) => bi !== b) } : e)),
    }));

  const save = () =>
    startSave(async () => {
      setMsg(null);
      const r = await saveStandardAction(draft);
      if (!r.ok) return setMsg({ kind: "error", text: `${t.saveError}${r.path ? ` (${r.path})` : ""}` });
      setCheck(r.check);
      setSavedDraft(JSON.stringify(draft));
      setMsg({ kind: "ok", text: t.saved });
    });
  const recheck = (template: TemplateId, lang: "he" | "en") =>
    startRecheck(async () => setCheck(await recheckAction(template, lang)));

  const idx = STEPS.indexOf(step);
  const passed = !dirty && check.passed && live.passed;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]" data-testid="cv-standard-editor">
      <div className="flex min-w-0 flex-col gap-5">
        {from && from in t.from ? (
          <p
            className="border-caution/40 bg-caution/10 rounded-md border p-3 text-sm"
            role="status"
            data-testid="cvs-from"
          >
            {t.from[from as keyof typeof t.from]}
          </p>
        ) : null}

        <nav aria-label={t.title} className="scroll-thin -mx-1 overflow-x-auto px-1">
          <ol className="flex w-max gap-1.5">
            {STEPS.map((s, i) => {
              const bad = failed(s).filter((r) => r.severity === "blocking").length;
              const warn = failed(s).filter((r) => r.severity === "warning").length;
              return (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => setStep(s)}
                    aria-current={s === step ? "step" : undefined}
                    data-testid={`cvs-step-${s}`}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold",
                      s === step ? "bg-foreground text-background" : "bg-card hover:bg-muted",
                    )}
                  >
                    <span className="font-mono text-xs opacity-70">{i + 1}</span>
                    {t.steps[s]}
                    {bad ? (
                      <span className="bg-destructive rounded-full px-1.5 text-xs text-white">{bad}</span>
                    ) : warn ? (
                      <span aria-hidden className="bg-caution size-2 rounded-full" />
                    ) : (
                      <Check aria-hidden className="size-3.5" />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <section className="bg-card flex flex-col gap-4 rounded-lg border p-4" aria-labelledby="cvs-step-title">
          <header className="flex flex-col gap-1">
            <h2 id="cvs-step-title" className="font-heading text-xl font-bold">
              {t.steps[step]}
            </h2>
            <p className="text-muted-foreground text-sm">{t.stepTips[step]}</p>
          </header>

          {step === "contact" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                id="cvs-name"
                label={t.fields.name}
                value={draft.name}
                onChange={(v) => set("name", v)}
                locale={locale}
              />
              <div className="flex flex-col gap-1.5">
                <Label>{t.fields.email}</Label>
                <p dir="ltr" className="bg-muted/50 min-h-10 content-center rounded-md px-3 text-sm">
                  {email}
                </p>
              </div>
              <Field
                id="cvs-phone"
                label={t.fields.phone}
                value={draft.phone}
                onChange={(v) => set("phone", v)}
                ltr
                inputMode="tel"
              />
              <Field
                id="cvs-location"
                label={t.fields.location}
                value={draft.location}
                onChange={(v) => set("location", v)}
                locale={locale}
              />
              <Field
                id="cvs-linkedin"
                label={t.fields.linkedinUrl}
                value={draft.linkedinUrl}
                onChange={(v) => set("linkedinUrl", v)}
                ltr
                placeholder="https://www.linkedin.com/in/…"
              />
              <Field
                id="cvs-github"
                label={t.fields.githubUrl}
                value={draft.githubUrl}
                onChange={(v) => set("githubUrl", v)}
                ltr
                placeholder="https://github.com/…"
              />
              <Field
                id="cvs-portfolio"
                label={t.fields.portfolioUrl}
                value={draft.portfolioUrl}
                onChange={(v) => set("portfolioUrl", v)}
                ltr
                placeholder="https://…"
              />
            </div>
          )}

          {step === "summary" && (
            <div className="flex flex-col gap-3">
              <Field
                id="cvs-headline"
                label={t.fields.headline}
                value={draft.headline}
                onChange={(v) => set("headline", v)}
                locale={locale}
              />
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="cvs-summary">{t.fields.summary}</Label>
                  <span className="text-muted-foreground text-xs">
                    {fillS(t.words, { n: wordCount(draft.summary) })}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Textarea
                    id="cvs-summary"
                    rows={4}
                    value={draft.summary}
                    onChange={(e) => set("summary", e.target.value)}
                  />
                  <VoiceInputButton
                    locale={locale}
                    compact
                    onText={(v) => set("summary", v)}
                    getValue={() => draft.summary}
                    testId="cvs-summary-voice"
                  />
                </div>
              </div>
            </div>
          )}

          {(step === "experience" || step === "projects") && (
            <EntriesEditor
              t={t}
              locale={locale}
              section={step}
              entries={step === "experience" ? experience : projects}
              draft={draft[step]}
              onBullet={(i, b, v) => setBullet(step, i, b, v)}
              onAdd={(i) => addBullet(step, i)}
              onRemove={(i, b) => removeBullet(step, i, b)}
            />
          )}

          {step === "education" && (
            <ul className="flex flex-col gap-2">
              {education.map((e, i) => (
                <li key={i} className="rounded-md border p-3 text-sm">
                  <span className="font-semibold">{e.title || e.org}</span>
                  {e.title && e.org ? <span className="text-muted-foreground"> · {e.org}</span> : null}
                  {e.period ? <bdi className="text-muted-foreground ms-2 font-mono text-xs">{e.period}</bdi> : null}
                </li>
              ))}
            </ul>
          )}

          {step === "skills" && <SkillsEditor t={t} skills={draft.skills} onChange={(v) => set("skills", v)} />}

          {step === "page" && (
            <PageCheck
              t={t}
              check={check}
              dirty={dirty}
              busy={rechecking}
              templateNames={templateNames}
              onRecheck={recheck}
            />
          )}

          {(step === "experience" || step === "projects" || step === "education") && (
            <p className="text-muted-foreground text-sm">
              {t.editInProfile}{" "}
              <Link href="/profile?tab=experience" className="text-primary font-semibold underline">
                {t.toProfile}
              </Link>
            </p>
          )}

          <RuleList t={t} results={failed(step)} />

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <Button type="button" onClick={save} disabled={saving} data-testid="cvs-save">
              {saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              {saving ? t.saving : t.save}
            </Button>
            {idx > 0 && (
              <Button type="button" variant="ghost" onClick={() => setStep(STEPS[idx - 1])}>
                {t.prev}
              </Button>
            )}
            {idx < STEPS.length - 1 && (
              <Button type="button" variant="outline" onClick={() => setStep(STEPS[idx + 1])} data-testid="cvs-next">
                {t.next}
              </Button>
            )}
            {msg && (
              <span role="status" className={cn("text-sm", msg.kind === "error" ? "text-destructive" : "text-fit")}>
                {msg.text}
              </span>
            )}
          </div>
        </section>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start" aria-label={t.meter.title}>
        <div
          className={cn(
            "flex flex-col gap-2 rounded-lg border p-4",
            passed ? "border-fit/40 bg-fit/10" : "border-caution/40 bg-caution/10",
          )}
          data-testid="cvs-status"
          data-passed={passed ? "1" : "0"}
        >
          <p className="flex items-center gap-2 font-bold">
            {passed ? <Check aria-hidden className="size-4" /> : <CircleAlert aria-hidden className="size-4" />}
            {passed ? t.done : fillS(t.status.failed, { n: blockingCount || 1 })}
          </p>
          <p className="text-muted-foreground text-sm">
            {fillS(t.status.score, { score: live.score })} · {fillS(t.status.warnings, { n: live.warnings.length })}
          </p>
          {passed && (
            <div className="flex flex-wrap gap-2">
              {from === "onboarding" ? (
                <Button asChild size="sm">
                  <Link href="/onboarding?step=4">{t.continueOnboarding}</Link>
                </Button>
              ) : from === "applied" ? (
                <Button asChild size="sm">
                  <Link href="/dashboard">{t.backToApps}</Link>
                </Button>
              ) : (
                <Button asChild size="sm">
                  <Link href="/cv">{t.toExport}</Link>
                </Button>
              )}
            </div>
          )}
        </div>
        <Meter t={t} check={check} dirty={dirty} />
        <div className="hidden lg:block">
          <ScaledSheet label={templateNames[check.template]}>
            <CvPreview
              content={content}
              layout={layouts[check.template]}
              tpl={TEMPLATES[check.template]}
              lang={check.lang}
            />
          </ScaledSheet>
        </div>
      </aside>
    </div>
  );
}

type T = ReturnType<typeof cvStandardStrings>;

function Field({
  id,
  label,
  value,
  onChange,
  ltr,
  locale,
  placeholder,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  ltr?: boolean;
  locale?: string;
  placeholder?: string;
  inputMode?: "tel";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          dir={ltr ? "ltr" : undefined}
          value={value}
          placeholder={placeholder}
          inputMode={inputMode}
          onChange={(e) => onChange(e.target.value)}
        />
        {!ltr && (
          <VoiceInputButton locale={locale} compact onText={onChange} getValue={() => value} testId={`${id}-voice`} />
        )}
      </div>
    </div>
  );
}

function RuleList({ t, results }: { t: T; results: RuleResult[] }) {
  if (!results.length) return null;
  const ordered = [...results].sort((a, b) => Number(b.severity === "blocking") - Number(a.severity === "blocking"));
  return (
    <ul className="flex flex-col gap-2" data-testid="cvs-rules">
      {ordered.map((r) => {
        const txt = t.rules[r.id];
        const block = r.severity === "blocking";
        return (
          <li
            key={r.id}
            data-rule={r.id}
            data-severity={r.severity}
            className={cn(
              "flex gap-2 rounded-md border p-2.5 text-sm",
              block ? "border-destructive/40 bg-destructive/5" : "border-caution/40 bg-caution/5",
            )}
          >
            {block ? (
              <CircleAlert aria-hidden className="text-destructive mt-0.5 size-4 shrink-0" />
            ) : (
              <AlertTriangle aria-hidden className="text-caution mt-0.5 size-4 shrink-0" />
            )}
            <span>
              <span className="font-semibold">
                {block ? t.blocking : t.warning} · {fillS(txt.title, r.params)}
              </span>
              <span className="text-muted-foreground block">{fillS(txt.tip, r.params)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Chips({ t, text }: { t: T; text: string }) {
  if (!text.trim()) return null;
  const f = bulletFeedback(text);
  const chip = (ok: boolean, label: string, key: string) => (
    <span
      key={key}
      data-chip={key}
      data-ok={ok ? "1" : "0"}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
        ok ? "bg-fit-soft text-fit" : "bg-caution-soft text-caution",
      )}
    >
      {ok ? <Check aria-hidden className="size-3" /> : <X aria-hidden className="size-3" />}
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-1.5">
      {chip(f.verb, f.verb ? t.feedback.verb : t.feedback.noVerb, "verb")}
      {chip(f.metric, f.metric ? t.feedback.metric : t.feedback.noMetric, "metric")}
      {f.length !== "ok" && chip(false, t.feedback[f.length], "length")}
      {f.pronoun && chip(false, t.feedback.pronoun, "pronoun")}
      <span className="text-muted-foreground text-xs">{fillS(t.chars, { n: text.trim().length })}</span>
    </div>
  );
}

function EntriesEditor({
  t,
  locale,
  section,
  entries,
  draft,
  onBullet,
  onAdd,
  onRemove,
}: {
  t: T;
  locale: "he" | "en";
  section: "experience" | "projects";
  entries: EntryInfo[];
  draft: { bullets: string[] }[];
  onBullet: (i: number, b: number, v: string) => void;
  onAdd: (i: number) => void;
  onRemove: (i: number, b: number) => void;
}) {
  if (!entries.length) return null;
  return (
    <ol className="flex flex-col gap-4">
      {entries.map((e, i) => (
        <li key={i} className="flex flex-col gap-2 rounded-md border p-3" data-testid={`cvs-${section}-${i}`}>
          <p className="font-semibold">
            {e.title}
            {e.org ? <span className="text-muted-foreground font-normal"> · {e.org}</span> : null}
            {e.period ? (
              <bdi className="text-muted-foreground ms-2 font-mono text-xs font-normal">{e.period}</bdi>
            ) : null}
          </p>
          {(draft[i]?.bullets ?? []).map((b, bi) => (
            <BulletRow
              key={bi}
              t={t}
              locale={locale}
              id={`cvs-${section}-${i}-${bi}`}
              value={b}
              onChange={(v) => onBullet(i, bi, v)}
              onRemove={() => onRemove(i, bi)}
              section={section}
              index={i}
            />
          ))}
          <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => onAdd(i)}>
            <Plus data-icon="inline-start" />
            {t.fields.addBullet}
          </Button>
        </li>
      ))}
    </ol>
  );
}

function BulletRow({
  t,
  locale,
  id,
  value,
  onChange,
  onRemove,
  section,
  index,
}: {
  t: T;
  locale: "he" | "en";
  id: string;
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
  section: "experience" | "projects";
  index: number;
}) {
  const [busy, start] = useTransition();
  const [res, setRes] = useState<ImproveResult | null>(null);
  const [metric, setMetric] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const lang = /[\u0590-\u05ff]/.test(value) ? "he" : locale === "en" && !/[\u0590-\u05ff]/.test(value) ? "en" : "he";
  const improve = () =>
    start(async () => setRes(await improveAction({ text: value, lang, section, index, metric: metric || undefined })));
  const ask = res?.ask ?? [];
  return (
    <div className="flex flex-col gap-1.5" data-testid={id}>
      <div className="flex items-start gap-2">
        <Textarea
          ref={ref}
          id={id}
          aria-label={t.fields.bullet}
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-16"
        />
        <div className="flex flex-col gap-1">
          <VoiceInputButton locale={locale} compact onText={onChange} getValue={() => value} testId={`${id}-voice`} />
          <Button type="button" variant="ghost" size="icon" aria-label={t.fields.removeBullet} onClick={onRemove}>
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Chips t={t} text={value} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={improve}
          disabled={busy || value.trim().length < 5}
          data-testid={`${id}-improve`}
        >
          {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
          {busy ? t.improve.working : t.improve.button}
        </Button>
      </div>
      {res && (
        <div
          className="bg-muted/50 flex flex-col gap-2 rounded-md p-3 text-sm"
          role="status"
          data-testid={`${id}-improve-result`}
          data-status={res.status}
        >
          {res.status === "ok" && res.rewrite ? (
            <>
              <p>
                <span className="font-semibold">{t.improve.suggestion}</span> <bdi>{res.rewrite}</bdi>
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    onChange(res.rewrite!);
                    setRes(null);
                  }}
                >
                  {t.improve.apply}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setRes(null)}>
                  {t.improve.dismiss}
                </Button>
              </div>
            </>
          ) : res.status === "rejected" ? (
            <p>{t.improve.rejected}</p>
          ) : res.status === "off" ? (
            <p>{t.improve.off}</p>
          ) : res.status === "limited" ? (
            <p>{t.improve.limited}</p>
          ) : res.status === "error" ? (
            <p>{t.improve.error}</p>
          ) : null}
          {ask.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="font-semibold">{t.improve.question}</p>
              {ask.includes("verb") && <p>{t.improve.askVerb}</p>}
              {ask.includes("metric") && (
                <>
                  <p>{res.question ?? t.improve.askMetric}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      aria-label={t.improve.metricLabel}
                      placeholder={t.improve.metricLabel}
                      value={metric}
                      onChange={(e) => setMetric(e.target.value)}
                      className="max-w-72"
                      data-testid={`${id}-metric`}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={improve}
                      disabled={busy || !metric.trim()}
                    >
                      {t.improve.retry}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
          <p className="text-muted-foreground text-xs">{t.improve.never}</p>
        </div>
      )}
    </div>
  );
}

function SkillsEditor({
  t,
  skills,
  onChange,
}: {
  t: T;
  skills: Draft["skills"];
  onChange: (v: Draft["skills"]) => void;
}) {
  const [name, setName] = useState("");
  const add = () => {
    const n = name.trim();
    if (!n || skills.some((s) => s.name.toLowerCase() === n.toLowerCase())) return;
    onChange([...skills, { name: n, category: "other" }]);
    setName("");
  };
  return (
    <div className="flex flex-col gap-3">
      <ul className="grid gap-2 sm:grid-cols-2">
        {skills.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2 rounded-md border p-2">
            <bdi className="min-w-0 flex-1 truncate font-medium" dir="auto">
              {s.name}
            </bdi>
            <select
              aria-label={`${t.fields.category}: ${s.name}`}
              value={s.category}
              onChange={(e) =>
                onChange(
                  skills.map((x, xi) => (xi === i ? { ...x, category: e.target.value as typeof x.category } : x)),
                )
              }
              className="bg-background h-9 rounded-md border px-2 text-sm"
            >
              {SKILL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t.categories[c] ?? c}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`✕ ${s.name}`}
              onClick={() => onChange(skills.filter((_, xi) => xi !== i))}
            >
              <X />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Input
          dir="auto"
          aria-label={t.fields.skills}
          placeholder="React, PostgreSQL…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="max-w-72"
          data-testid="cvs-skill-input"
        />
        <Button type="button" variant="outline" onClick={add}>
          <Plus data-icon="inline-start" />
          {t.fields.skills}
        </Button>
      </div>
    </div>
  );
}

function Meter({ t, check, dirty }: { t: T; check: CheckView; dirty: boolean }) {
  const pct = Math.round(Math.min(check.used, 2) * 100);
  const bar = Math.min(100, Math.round(check.used * 100));
  if (check.fitError)
    return (
      <div
        className="bg-caution-soft text-caution flex flex-col gap-2 rounded-lg border p-4"
        data-testid="cvs-meter"
        data-error="1"
        role="status"
      >
        <p className="flex items-center gap-2 text-sm font-bold">
          <FileText aria-hidden className="size-4" />
          {t.meter.title}
        </p>
        <p className="text-sm">{t.meter.error}</p>
      </div>
    );
  return (
    <div
      className="bg-card flex flex-col gap-2 rounded-lg border p-4"
      data-testid="cvs-meter"
      data-pages={check.pages}
      data-level={check.level}
    >
      <p className="flex items-center gap-2 text-sm font-bold">
        <FileText aria-hidden className="size-4" />
        {t.meter.title}
      </p>
      <div
        className="bg-muted h-2.5 overflow-hidden rounded-full"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={bar}
        aria-label={t.meter.title}
      >
        <div
          className={cn("h-full rounded-full", check.fits ? "bg-fit" : "bg-destructive")}
          style={{ width: `${bar}%` }}
        />
      </div>
      <p className={cn("text-sm font-semibold", check.fits ? "text-fit" : "text-destructive")}>
        {check.fits ? t.meter.fits : fillS(t.meter.over, { pages: check.pages })}
        <span className="text-muted-foreground font-normal"> · {fillS(t.meter.used, { pct })}</span>
      </p>
      {check.level > 0 && (
        <p className="text-muted-foreground text-xs">{fillS(t.meter.tightened, { level: check.level })}</p>
      )}
      {dirty && <p className="text-muted-foreground text-xs">{t.meter.stale}</p>}
      {!check.fits && check.cuts.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">{t.meter.cutsTitle}</p>
          <ul className="list-disc ps-5 text-sm" data-testid="cvs-cuts">
            {check.cuts.map((c, i) => (
              <li key={i}>{fillS(t.cuts[c.kind], c.params)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PageCheck({
  t,
  check,
  dirty,
  busy,
  templateNames,
  onRecheck,
}: {
  t: T;
  check: CheckView;
  dirty: boolean;
  busy: boolean;
  templateNames: Record<TemplateId, string>;
  onRecheck: (template: TemplateId, lang: "he" | "en") => void;
}) {
  const [tpl, setTpl] = useState<TemplateId>(check.template);
  const [lang, setLang] = useState<"he" | "en">(check.lang);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cvs-tpl">{t.meter.template}</Label>
          <select
            id="cvs-tpl"
            value={tpl}
            onChange={(e) => setTpl(e.target.value as TemplateId)}
            className="bg-background h-10 rounded-md border px-2 text-sm"
          >
            {TEMPLATE_IDS.map((id) => (
              <option key={id} value={id}>
                {templateNames[id]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cvs-lang">{t.meter.lang}</Label>
          <select
            id="cvs-lang"
            value={lang}
            onChange={(e) => setLang(e.target.value as "he" | "en")}
            className="bg-background h-10 rounded-md border px-2 text-sm"
          >
            <option value="he">עברית</option>
            <option value="en">English</option>
          </select>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => onRecheck(tpl, lang)}
          disabled={busy || dirty}
          data-testid="cvs-recheck"
        >
          {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          {t.meter.recheck}
        </Button>
      </div>
      <Meter t={t} check={check} dirty={dirty} />
    </div>
  );
}
