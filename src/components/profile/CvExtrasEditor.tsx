"use client";

import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import { ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type T = Dictionary["pv2"];

export interface ProjectUi {
  _k: number;
  name: string;
  role: string;
  url: string;
  start: string;
  end: string;
  description: string;
  tech: string;
}
export interface VolunteerUi {
  _k: number;
  organization: string;
  role: string;
  start: string;
  end: string;
  description: string;
}
export interface CustomUi {
  _k: number;
  id: string;
  title: string;
  body: string;
}

function Head({
  id,
  title,
  count,
  onAdd,
  addLabel,
}: {
  id: string;
  title: string;
  count: number;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div id={id} className="flex items-center justify-between gap-3">
      <h2 className="font-heading text-xl font-bold">
        {title}
        {count ? <span className="text-muted-foreground ms-2 font-mono text-sm font-normal">{count}</span> : null}
      </h2>
      <Button type="button" variant="outline" onClick={onAdd}>
        <Plus data-icon="inline-start" />
        {addLabel}
      </Button>
    </div>
  );
}

function Tools({
  t,
  i,
  label,
  onUp,
  onRemove,
}: {
  t: T;
  i: number;
  label: string;
  onUp: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      {i > 0 && (
        <Button type="button" variant="ghost" size="icon" onClick={onUp} aria-label={`${t.moveUp}: ${label}`}>
          <ArrowUp />
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-destructive"
        onClick={onRemove}
        aria-label={`${t.remove}: ${label}`}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  ltr,
  placeholder,
  className,
  type,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  ltr?: boolean;
  placeholder?: string;
  className?: string;
  type?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        className={ltr ? "input font-mono" : "input"}
        dir={ltr ? "ltr" : "auto"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Area({
  id,
  label,
  value,
  onChange,
  testId,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        <label className="label" htmlFor={id}>
          {label}
        </label>
        <VoiceInputButton targetId={id} size="sm" testId={testId} />
      </div>
      <textarea
        id={id}
        dir="auto"
        className="input field-sizing-content min-h-20 leading-relaxed"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

const up = <X,>(list: X[], i: number) => {
  const n = [...list];
  [n[i - 1], n[i]] = [n[i], n[i - 1]];
  return n;
};
let seq = 1_000_000;
const nk = () => ++seq;

export function ProjectsEditor({
  t,
  id,
  items,
  onChange,
}: {
  t: T;
  id: string;
  items: ProjectUi[];
  onChange: (v: ProjectUi[]) => void;
}) {
  const patch = (i: number, v: Partial<ProjectUi>) => onChange(items.map((x, j) => (j === i ? { ...x, ...v } : x)));
  return (
    <section className="form-section" aria-labelledby={`${id}-proj`} data-testid="projects-editor">
      <Head
        id={`${id}-proj`}
        title={t.projects}
        count={items.length}
        addLabel={t.addProject}
        onAdd={() =>
          onChange([...items, { _k: nk(), name: "", role: "", url: "", start: "", end: "", description: "", tech: "" }])
        }
      />
      {items.length === 0 && <p className="text-muted-foreground text-sm">{t.empty}</p>}
      <ol className="flex flex-col gap-4">
        {items.map((p, i) => {
          const f = `${id}-p${p._k}`;
          return (
            <li key={p._k} className="bg-card rounded-lg border p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <Field
                    id={`${f}-name`}
                    label={t.projectName}
                    value={p.name}
                    onChange={(v) => patch(i, { name: v })}
                  />
                  <Field
                    id={`${f}-role`}
                    label={t.projectRole}
                    value={p.role}
                    onChange={(v) => patch(i, { role: v })}
                  />
                </div>
                <Tools
                  t={t}
                  i={i}
                  label={p.name || t.projects}
                  onUp={() => onChange(up(items, i))}
                  onRemove={() => onChange(items.filter((_, j) => j !== i))}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                <Field
                  id={`${f}-url`}
                  type="url"
                  ltr
                  label={t.projectUrl}
                  placeholder="https://…"
                  value={p.url}
                  onChange={(v) => patch(i, { url: v })}
                  className="col-span-2 sm:col-span-1"
                />
                <Field
                  id={`${f}-s`}
                  ltr
                  label={t.start}
                  placeholder="YYYY-MM"
                  value={p.start}
                  onChange={(v) => patch(i, { start: v })}
                />
                <Field
                  id={`${f}-e`}
                  ltr
                  label={t.end}
                  placeholder="YYYY-MM"
                  value={p.end}
                  onChange={(v) => patch(i, { end: v })}
                />
              </div>
              <div className="mt-3">
                <Area
                  id={`${f}-desc`}
                  label={t.description}
                  testId="project-voice"
                  value={p.description}
                  onChange={(v) => patch(i, { description: v })}
                />
              </div>
              <Field
                id={`${f}-tech`}
                ltr
                label={t.tech}
                value={p.tech}
                onChange={(v) => patch(i, { tech: v })}
                className="mt-3"
              />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function VolunteeringEditor({
  t,
  id,
  items,
  onChange,
}: {
  t: T;
  id: string;
  items: VolunteerUi[];
  onChange: (v: VolunteerUi[]) => void;
}) {
  const patch = (i: number, v: Partial<VolunteerUi>) => onChange(items.map((x, j) => (j === i ? { ...x, ...v } : x)));
  return (
    <section className="form-section" aria-labelledby={`${id}-vol`} data-testid="volunteering-editor">
      <Head
        id={`${id}-vol`}
        title={t.volunteering}
        count={items.length}
        addLabel={t.addVolunteering}
        onAdd={() =>
          onChange([...items, { _k: nk(), organization: "", role: "", start: "", end: "", description: "" }])
        }
      />
      {items.length === 0 && <p className="text-muted-foreground text-sm">{t.empty}</p>}
      <ol className="flex flex-col gap-4">
        {items.map((v, i) => {
          const f = `${id}-v${v._k}`;
          return (
            <li key={v._k} className="bg-card rounded-lg border p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <Field
                    id={`${f}-org`}
                    label={t.organization}
                    value={v.organization}
                    onChange={(x) => patch(i, { organization: x })}
                  />
                  <Field
                    id={`${f}-role`}
                    label={t.volunteerRole}
                    value={v.role}
                    onChange={(x) => patch(i, { role: x })}
                  />
                </div>
                <Tools
                  t={t}
                  i={i}
                  label={v.organization || t.volunteering}
                  onUp={() => onChange(up(items, i))}
                  onRemove={() => onChange(items.filter((_, j) => j !== i))}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field
                  id={`${f}-s`}
                  ltr
                  label={t.start}
                  placeholder="YYYY-MM"
                  value={v.start}
                  onChange={(x) => patch(i, { start: x })}
                />
                <Field
                  id={`${f}-e`}
                  ltr
                  label={t.end}
                  placeholder="YYYY-MM"
                  value={v.end}
                  onChange={(x) => patch(i, { end: x })}
                />
              </div>
              <div className="mt-3">
                <Area
                  id={`${f}-desc`}
                  label={t.description}
                  testId="volunteer-voice"
                  value={v.description}
                  onChange={(x) => patch(i, { description: x })}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function CustomSectionsEditor({
  t,
  id,
  items,
  onChange,
}: {
  t: T;
  id: string;
  items: CustomUi[];
  onChange: (v: CustomUi[]) => void;
}) {
  const patch = (i: number, v: Partial<CustomUi>) => onChange(items.map((x, j) => (j === i ? { ...x, ...v } : x)));
  return (
    <section className="form-section" aria-labelledby={`${id}-cus`} data-testid="custom-sections-editor">
      <Head
        id={`${id}-cus`}
        title={t.customSections}
        count={items.length}
        addLabel={t.addCustomSection}
        onAdd={() =>
          items.length < 6 &&
          onChange([...items, { _k: nk(), id: Math.random().toString(36).slice(2, 10), title: "", body: "" }])
        }
      />
      <p className="text-muted-foreground text-sm">{t.customSectionsHint}</p>
      <ol className="flex flex-col gap-4">
        {items.map((c, i) => {
          const f = `${id}-c${c._k}`;
          return (
            <li key={c._k} className="bg-card rounded-lg border p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <Field
                  id={`${f}-title`}
                  label={t.customTitle}
                  value={c.title}
                  onChange={(x) => patch(i, { title: x })}
                  className="flex-1"
                />
                <Tools
                  t={t}
                  i={i}
                  label={c.title || t.customSections}
                  onUp={() => onChange(up(items, i))}
                  onRemove={() => onChange(items.filter((_, j) => j !== i))}
                />
              </div>
              <div className="mt-3">
                <Area
                  id={`${f}-body`}
                  label={t.customBody}
                  testId="custom-voice"
                  value={c.body}
                  onChange={(x) => patch(i, { body: x })}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
