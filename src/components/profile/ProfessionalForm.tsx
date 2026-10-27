"use client";

import { ArrowUp, Plus, Trash2 } from "lucide-react";
import { useActionState, useId, useMemo, useState } from "react";
import { saveProfessional, type ActionState } from "@/app/profile/actions";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  EDUCATION_KINDS,
  LANGUAGE_LEVELS,
  SKILL_CATEGORIES,
  SKILL_LEVELS,
  type Professional,
  type SkillCategory,
  categorizeSkill,
} from "@/lib/profile/schema";

type T = Dictionary["pv2"];
type Keyed<X> = X & { _k: number };
let seq = 0;
const k = <X,>(x: X): Keyed<X> => ({ ...x, _k: ++seq });

/** UI model keeps free-text fields as strings and converts once on submit. */
interface ExpUi {
  company: string;
  title: string;
  start: string;
  end: string;
  current: boolean;
  description: string;
  tech: string;
}
interface SkillUi {
  name: string;
  level: (typeof SKILL_LEVELS)[number];
  years: string;
  category: SkillCategory;
}

function toUi(p: Professional) {
  return {
    headline: p.headline,
    summary: p.summary,
    experience: p.experience.map((e) =>
      k<ExpUi>({
        company: e.company,
        title: e.title,
        start: e.start ?? "",
        end: e.end ?? "",
        current: !e.end,
        description: e.description,
        tech: e.tech.join(", "),
      }),
    ),
    skills: p.skillItems.map((s) =>
      k<SkillUi>({ name: s.name, level: s.level, years: s.years == null ? "" : String(s.years), category: s.category }),
    ),
    education: p.education.map((e) => k({ ...e, start: e.start ?? "", end: e.end ?? "" })),
    languages: p.languages.map((l) => k(l)),
    linkedinUrl: p.linkedinUrl,
    githubUrl: p.githubUrl,
    portfolioUrl: p.portfolioUrl,
  };
}
type Ui = ReturnType<typeof toUi>;

function toPayload(u: Ui): Professional {
  const strip = <X extends { _k: number }>(x: X) => {
    const { _k: _omit, ...rest } = x;
    void _omit;
    return rest;
  };
  return {
    headline: u.headline.trim(),
    summary: u.summary.trim(),
    experience: u.experience
      .filter((e) => e.company.trim() && e.title.trim())
      .map((e) => ({
        company: e.company.trim(),
        title: e.title.trim(),
        start: e.start.trim(),
        end: e.current ? "" : e.end.trim(),
        description: e.description.trim(),
        tech: [
          ...new Set(
            e.tech
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          ),
        ],
      })),
    skillItems: u.skills
      .filter((s) => s.name.trim())
      .map((s) => ({
        name: s.name.trim(),
        level: s.level,
        years: s.years.trim() === "" ? null : Math.max(0, Math.min(45, Number(s.years) || 0)),
        category: s.category,
      })),
    education: u.education.filter((e) => e.institution.trim()).map(strip),
    languages: u.languages.filter((l) => l.name.trim()).map(strip),
    linkedinUrl: u.linkedinUrl.trim(),
    githubUrl: u.githubUrl.trim(),
    portfolioUrl: u.portfolioUrl.trim(),
  };
}

function move<X>(list: X[], i: number): X[] {
  if (i <= 0) return list;
  const next = [...list];
  [next[i - 1], next[i]] = [next[i], next[i - 1]];
  return next;
}

function SectionHead({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-heading text-xl font-bold">
        {title}
        {count ? <span className="text-muted-foreground ms-2 font-mono text-sm font-normal">{count}</span> : null}
      </h2>
      {action}
    </div>
  );
}

function RowTools({
  t,
  index,
  onUp,
  onRemove,
  label,
}: {
  t: T;
  index: number;
  onUp: () => void;
  onRemove: () => void;
  label: string;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      {index > 0 && (
        <Button type="button" variant="ghost" size="icon" onClick={onUp} aria-label={`${t.moveUp}: ${label}`}>
          <ArrowUp />
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label={`${t.remove}: ${label}`}
        className="text-destructive"
      >
        <Trash2 />
      </Button>
    </div>
  );
}

export function ProfessionalForm({
  t,
  initial,
  submitLabel,
  resumeId,
  next,
}: {
  t: T;
  initial: Professional;
  submitLabel?: string;
  resumeId?: string;
  next?: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveProfessional, undefined);
  const [u, setU] = useState<Ui>(() => toUi(initial));
  const [newSkill, setNewSkill] = useState("");
  const id = useId();
  const payload = useMemo(() => JSON.stringify(toPayload(u)), [u]);

  const set = <K extends keyof Ui>(key: K, v: Ui[K]) => setU((p) => ({ ...p, [key]: v }));
  const patch = <K extends "experience" | "skills" | "education" | "languages">(
    key: K,
    i: number,
    v: Partial<Ui[K][number]>,
  ) => setU((p) => ({ ...p, [key]: (p[key] as Ui[K][number][]).map((x, j) => (j === i ? { ...x, ...v } : x)) }));
  const remove = (key: "experience" | "skills" | "education" | "languages", i: number) =>
    setU((p) => ({ ...p, [key]: (p[key] as unknown[]).filter((_, j) => j !== i) }));

  const addSkill = () => {
    const names = newSkill
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!names.length) return;
    setU((p) => {
      const have = new Set(p.skills.map((s) => s.name.toLowerCase()));
      const add = names
        .filter((n) => !have.has(n.toLowerCase()))
        .map((name) => k<SkillUi>({ name, level: "GOOD", years: "", category: categorizeSkill(name) }));
      return { ...p, skills: [...p.skills, ...add] };
    });
    setNewSkill("");
  };

  const grouped = SKILL_CATEGORIES.map((c) => ({
    c,
    items: u.skills.map((s, i) => ({ s, i })).filter(({ s }) => s.category === c),
  })).filter((g) => g.items.length);

  return (
    <form action={action} className="flex flex-col gap-10" noValidate>
      <input dir="auto" type="hidden" name="payload" value={payload} />
      {resumeId && <input dir="auto" type="hidden" name="resumeId" value={resumeId} />}
      {next && <input dir="auto" type="hidden" name="next" value={next} />}

      {/* ── Headline & summary ── */}
      <section className="flex flex-col gap-4">
        <div>
          <label className="label" htmlFor={`${id}-headline`}>
            {t.headline}
          </label>
          <input
            id={`${id}-headline`}
            className="input font-heading text-lg font-bold sm:text-lg"
            value={u.headline}
            maxLength={140}
            placeholder={t.headlinePh}
            onChange={(e) => set("headline", e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor={`${id}-summary`}>
            {t.summary}
          </label>
          <textarea
            id={`${id}-summary`}
            dir="auto"
            className="input field-sizing-content min-h-28 leading-relaxed"
            value={u.summary}
            maxLength={2000}
            placeholder={t.summaryPh}
            onChange={(e) => set("summary", e.target.value)}
          />
        </div>
      </section>

      {/* ── Experience ── */}
      <section className="form-section" aria-labelledby={`${id}-exp`}>
        <div id={`${id}-exp`}>
          <SectionHead
            title={t.experience}
            count={u.experience.length}
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  set("experience", [
                    k<ExpUi>({ company: "", title: "", start: "", end: "", current: true, description: "", tech: "" }),
                    ...u.experience,
                  ])
                }
              >
                <Plus data-icon="inline-start" />
                {t.addExperience}
              </Button>
            }
          />
        </div>
        {u.experience.length === 0 && <p className="text-muted-foreground text-sm">{t.empty}</p>}
        <ol className="flex flex-col gap-4">
          {u.experience.map((e, i) => {
            const p = `${id}-e${e._k}`;
            return (
              <li key={e._k} data-exp-item className="bg-card relative rounded-lg border p-4 ps-5 sm:p-5 sm:ps-6">
                <span aria-hidden className="bg-primary absolute inset-y-4 start-0 w-1 rounded-e" />
                <div className="flex items-start gap-3">
                  <div className="grid flex-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor={`${p}-title`}>
                        {t.title}
                      </label>
                      <input
                        id={`${p}-title`}
                        className="input font-semibold"
                        value={e.title}
                        onChange={(ev) => patch("experience", i, { title: ev.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor={`${p}-company`}>
                        {t.company}
                      </label>
                      <input
                        id={`${p}-company`}
                        className="input"
                        value={e.company}
                        onChange={(ev) => patch("experience", i, { company: ev.target.value })}
                      />
                    </div>
                  </div>
                  <RowTools
                    t={t}
                    index={i}
                    label={e.title || t.experience}
                    onUp={() => set("experience", move(u.experience, i))}
                    onRemove={() => remove("experience", i)}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <div>
                    <label className="label" htmlFor={`${p}-start`}>
                      {t.start}
                    </label>
                    <input
                      id={`${p}-start`}
                      className="input font-mono"
                      dir="ltr"
                      inputMode="numeric"
                      placeholder="YYYY-MM"
                      pattern="\d{4}(-\d{2})?"
                      value={e.start}
                      onChange={(ev) => patch("experience", i, { start: ev.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`${p}-end`}>
                      {t.end}
                    </label>
                    <input
                      id={`${p}-end`}
                      className="input font-mono disabled:opacity-50"
                      dir="ltr"
                      inputMode="numeric"
                      placeholder="YYYY-MM"
                      disabled={e.current}
                      value={e.current ? "" : e.end}
                      onChange={(ev) => patch("experience", i, { end: ev.target.value })}
                    />
                  </div>
                  <label className="toggle-chip col-span-2 justify-center sm:col-span-1">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={e.current}
                      onChange={(ev) => patch("experience", i, { current: ev.target.checked })}
                    />
                    {t.current}
                  </label>
                </div>
                <div className="mt-3">
                  <label className="label" htmlFor={`${p}-desc`}>
                    {t.description}
                  </label>
                  <textarea
                    id={`${p}-desc`}
                    dir="auto"
                    className="input field-sizing-content min-h-24 leading-relaxed"
                    placeholder={t.descriptionPh}
                    value={e.description}
                    onChange={(ev) => patch("experience", i, { description: ev.target.value })}
                  />
                </div>
                <div className="mt-3">
                  <label className="label" htmlFor={`${p}-tech`}>
                    {t.tech}
                  </label>
                  <input
                    id={`${p}-tech`}
                    className="input font-mono"
                    dir="ltr"
                    value={e.tech}
                    onChange={(ev) => patch("experience", i, { tech: ev.target.value })}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ── Skills ── */}
      <section className="form-section" aria-labelledby={`${id}-skills`}>
        <div id={`${id}-skills`}>
          <SectionHead title={t.skills} count={u.skills.length} />
        </div>
        <div className="flex gap-2">
          <label htmlFor={`${id}-newskill`} className="sr-only">
            {t.addSkill}
          </label>
          <input
            id={`${id}-newskill`}
            className="input font-mono"
            dir="ltr"
            placeholder="Go, Kafka, Terraform"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSkill();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addSkill}>
            <Plus data-icon="inline-start" />
            {t.addSkill}
          </Button>
        </div>
        {grouped.length === 0 && <p className="text-muted-foreground text-sm">{t.empty}</p>}
        <div className="flex flex-col gap-6">
          {grouped.map(({ c, items }) => (
            <fieldset key={c} className="flex flex-col gap-2">
              <legend className="kicker mb-2">{t.categories[c]}</legend>
              <ul className="divide-border bg-card divide-y rounded-lg border">
                {items.map(({ s, i }) => {
                  const p = `${id}-s${s._k}`;
                  return (
                    <li
                      key={s._k}
                      data-skill-item
                      className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3"
                    >
                      <div className="flex min-w-0 items-center gap-2 sm:w-80 sm:shrink-0">
                        <label htmlFor={`${p}-name`} className="sr-only">
                          {t.skillName}
                        </label>
                        <input
                          id={`${p}-name`}
                          dir="ltr"
                          className="input min-w-0 flex-1 font-mono font-semibold"
                          value={s.name}
                          onChange={(e) => patch("skills", i, { name: e.target.value })}
                        />
                        <label htmlFor={`${p}-cat`} className="sr-only">
                          {t.category}
                        </label>
                        <select
                          id={`${p}-cat`}
                          className="select-native w-32 shrink-0 text-sm sm:w-36"
                          value={s.category}
                          onChange={(e) => patch("skills", i, { category: e.target.value as SkillCategory })}
                        >
                          {SKILL_CATEGORIES.map((cc) => (
                            <option key={cc} value={cc}>
                              {t.categories[cc]}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive sm:hidden"
                          onClick={() => remove("skills", i)}
                          aria-label={`${t.remove}: ${s.name}`}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 sm:flex-1">
                        <div
                          role="radiogroup"
                          aria-label={`${t.level}: ${s.name}`}
                          className="bg-muted inline-flex flex-1 rounded-md p-0.5 sm:flex-none"
                        >
                          {SKILL_LEVELS.map((lv) => (
                            <button
                              key={lv}
                              type="button"
                              role="radio"
                              aria-checked={s.level === lv}
                              onClick={() => patch("skills", i, { level: lv })}
                              className="aria-checked:bg-foreground aria-checked:text-background focus-visible:ring-primary/40 min-h-10 flex-1 rounded px-3 text-xs font-semibold transition-colors outline-none focus-visible:ring-3"
                            >
                              {t.levels[lv]}
                            </button>
                          ))}
                        </div>
                        <label className="flex items-center gap-1.5 text-sm">
                          <span className="text-muted-foreground">{t.years}</span>
                          <input
                            className="input w-18 font-mono"
                            dir="ltr"
                            type="number"
                            min={0}
                            max={45}
                            step={0.5}
                            inputMode="decimal"
                            value={s.years}
                            onChange={(e) => patch("skills", i, { years: e.target.value })}
                          />
                        </label>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hidden sm:inline-flex"
                        onClick={() => remove("skills", i)}
                        aria-label={`${t.remove}: ${s.name}`}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ))}
        </div>
      </section>

      {/* ── Education, courses & service ── */}
      <section className="form-section" aria-labelledby={`${id}-edu`}>
        <div id={`${id}-edu`}>
          <SectionHead
            title={t.education}
            count={u.education.length}
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  set("education", [
                    ...u.education,
                    k({ kind: "DEGREE" as const, institution: "", title: "", start: "", end: "" }),
                  ])
                }
              >
                <Plus data-icon="inline-start" />
                {t.addEducation}
              </Button>
            }
          />
        </div>
        {u.education.length === 0 && <p className="text-muted-foreground text-sm">{t.empty}</p>}
        <ul className="flex flex-col gap-3">
          {u.education.map((e, i) => {
            const p = `${id}-ed${e._k}`;
            return (
              <li
                key={e._k}
                className="bg-card grid gap-3 rounded-lg border p-4 sm:grid-cols-[10rem_1fr_1fr_5.5rem_5.5rem_auto] sm:items-end"
              >
                <div>
                  <label className="label" htmlFor={`${p}-kind`}>
                    {t.kind}
                  </label>
                  <select
                    id={`${p}-kind`}
                    className="select-native"
                    value={e.kind}
                    onChange={(ev) =>
                      patch("education", i, { kind: ev.target.value as (typeof EDUCATION_KINDS)[number] })
                    }
                  >
                    {EDUCATION_KINDS.map((kk) => (
                      <option key={kk} value={kk}>
                        {t.eduKinds[kk]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor={`${p}-inst`}>
                    {t.institution}
                  </label>
                  <input
                    id={`${p}-inst`}
                    className="input"
                    value={e.institution}
                    onChange={(ev) => patch("education", i, { institution: ev.target.value })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`${p}-prog`}>
                    {t.program}
                  </label>
                  <input
                    id={`${p}-prog`}
                    className="input"
                    value={e.title}
                    onChange={(ev) => patch("education", i, { title: ev.target.value })}
                  />
                </div>
                <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3 sm:contents">
                  <div>
                    <label className="label" htmlFor={`${p}-s`}>
                      {t.start}
                    </label>
                    <input
                      id={`${p}-s`}
                      className="input font-mono"
                      dir="ltr"
                      inputMode="numeric"
                      placeholder="YYYY"
                      value={e.start}
                      onChange={(ev) => patch("education", i, { start: ev.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`${p}-e`}>
                      {t.end}
                    </label>
                    <input
                      id={`${p}-e`}
                      className="input font-mono"
                      dir="ltr"
                      inputMode="numeric"
                      placeholder="YYYY"
                      value={e.end}
                      onChange={(ev) => patch("education", i, { end: ev.target.value })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => remove("education", i)}
                    aria-label={`${t.remove}: ${e.institution || t.education}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Languages & links ── */}
      <div className="grid gap-10 lg:grid-cols-2">
        <section className="form-section" aria-labelledby={`${id}-lang`}>
          <div id={`${id}-lang`}>
            <SectionHead
              title={t.languages}
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => set("languages", [...u.languages, k({ name: "", level: "FLUENT" as const })])}
                >
                  <Plus data-icon="inline-start" />
                  {t.addLanguage}
                </Button>
              }
            />
          </div>
          {u.languages.length === 0 && <p className="text-muted-foreground text-sm">{t.empty}</p>}
          <ul className="flex flex-col gap-2">
            {u.languages.map((l, i) => (
              <li key={l._k} className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`${id}-l${l._k}`}>
                  {t.language}
                </label>
                <input
                  id={`${id}-l${l._k}`}
                  className="input"
                  value={l.name}
                  onChange={(e) => patch("languages", i, { name: e.target.value })}
                />
                <label className="sr-only" htmlFor={`${id}-ll${l._k}`}>
                  {t.level}
                </label>
                <select
                  id={`${id}-ll${l._k}`}
                  className="select-native w-40 shrink-0"
                  value={l.level}
                  onChange={(e) => patch("languages", i, { level: e.target.value as (typeof LANGUAGE_LEVELS)[number] })}
                >
                  {LANGUAGE_LEVELS.map((lv) => (
                    <option key={lv} value={lv}>
                      {t.langLevels[lv]}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive shrink-0"
                  onClick={() => remove("languages", i)}
                  aria-label={`${t.remove}: ${l.name || t.language}`}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </section>
        <section className="form-section" aria-labelledby={`${id}-links`}>
          <h2 id={`${id}-links`} className="font-heading text-xl font-bold">
            {t.links}
          </h2>
          {(
            [
              ["githubUrl", t.github, "https://github.com/…"],
              ["linkedinUrl", t.linkedin, "https://linkedin.com/in/…"],
              ["portfolioUrl", t.portfolio, "https://…"],
            ] as const
          ).map(([key, label, ph]) => (
            <div key={key}>
              <label className="label" htmlFor={`${id}-${key}`}>
                {label}
              </label>
              <input
                id={`${id}-${key}`}
                type="url"
                dir="ltr"
                className="input font-mono"
                placeholder={ph}
                value={u[key]}
                onChange={(e) => set(key, e.target.value)}
              />
            </div>
          ))}
        </section>
      </div>

      {/* ── Sticky save bar (sits above the mobile tab bar) ── */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] z-20 -mx-4 flex items-center gap-3 border-t px-4 py-3 backdrop-blur md:bottom-0">
        <Button type="submit" size="lg" disabled={pending} className="flex-1 sm:flex-none">
          {pending ? t.saving : (submitLabel ?? t.save)}
        </Button>
        <p role="status" aria-live="polite" className="text-sm">
          {state?.error && <span className="text-destructive">{state.error}</span>}
          {state?.ok && <span className="text-fit font-semibold">{state.ok}</span>}
        </p>
      </div>
    </form>
  );
}
