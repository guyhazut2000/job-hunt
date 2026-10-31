"use client";

import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import { ArrowUp, Plus, Trash2 } from "lucide-react";
import { useActionState, useId, useMemo, useState } from "react";
import { saveProfessional, type ActionState } from "@/app/profile/actions";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  EDUCATION_KINDS,
  LANGUAGE_LEVELS,
  SKILL_LEVELS,
  type Professional,
  type SkillCategory,
  categorizeSkill,
} from "@/lib/profile/schema";
import { skillKey } from "@/lib/profile/skills-view";
import { SkillsEditor } from "./SkillsEditor";
import {
  CustomSectionsEditor,
  ProjectsEditor,
  VolunteeringEditor,
  type CustomUi,
  type ProjectUi,
  type VolunteerUi,
} from "./CvExtrasEditor";

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
    phone: p.phone,
    projects: p.projects.map((x) =>
      k<Omit<ProjectUi, "_k">>({ ...x, start: x.start ?? "", end: x.end ?? "", tech: x.tech.join(", ") }),
    ),
    volunteering: p.volunteering.map((x) =>
      k<Omit<VolunteerUi, "_k">>({ ...x, start: x.start ?? "", end: x.end ?? "" }),
    ),
    customSections: p.customSections.map((x) => k<Omit<CustomUi, "_k">>(x)),
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
    phone: u.phone.trim(),
    projects: u.projects
      .filter((p) => p.name.trim())
      .map((p) => ({
        name: p.name.trim(),
        role: p.role.trim(),
        url: p.url.trim(),
        start: p.start.trim(),
        end: p.end.trim(),
        description: p.description.trim(),
        tech: [
          ...new Set(
            p.tech
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          ),
        ],
      })),
    volunteering: u.volunteering
      .filter((v) => v.organization.trim())
      .map((v) => ({
        organization: v.organization.trim(),
        role: v.role.trim(),
        start: v.start.trim(),
        end: v.end.trim(),
        description: v.description.trim(),
      })),
    customSections: u.customSections
      .filter((c) => c.title.trim())
      .map((c) => ({ id: c.id, title: c.title.trim(), body: c.body.trim() })),
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

  const addSkills = (names: string[]) =>
    setU((p) => {
      const have = new Set(p.skills.map((s) => skillKey(s.name)));
      const add = names
        .filter((n) => !have.has(skillKey(n)))
        .map((name) => k<SkillUi>({ name, level: "GOOD", years: "", category: categorizeSkill(name) }));
      return { ...p, skills: [...p.skills, ...add] };
    });

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
          <div className="flex items-end justify-between gap-2">
            <label className="label" htmlFor={`${id}-summary`}>
              {t.summary}
            </label>
            <VoiceInputButton targetId={`${id}-summary`} size="sm" testId="summary-voice" />
          </div>
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
                  <div className="flex items-end justify-between gap-2">
                    <label className="label" htmlFor={`${p}-desc`}>
                      {t.description}
                    </label>
                    <VoiceInputButton targetId={`${p}-desc`} size="sm" testId="experience-voice" />
                  </div>
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
        <SkillsEditor
          t={t}
          id={id}
          skills={u.skills}
          onAdd={addSkills}
          onPatch={(i, v) => patch("skills", i, v)}
          onRemove={(i) => remove("skills", i)}
        />
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

      <ProjectsEditor t={t} id={id} items={u.projects} onChange={(v) => set("projects", v)} />
      <VolunteeringEditor t={t} id={id} items={u.volunteering} onChange={(v) => set("volunteering", v)} />

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
          <div>
            <label className="label" htmlFor={`${id}-phone`}>
              {t.phone}
            </label>
            <input
              id={`${id}-phone`}
              type="tel"
              dir="ltr"
              autoComplete="tel"
              className="input font-mono"
              placeholder="050-0000000"
              value={u.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
        </section>
      </div>

      <CustomSectionsEditor t={t} id={id} items={u.customSections} onChange={(v) => set("customSections", v)} />

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
