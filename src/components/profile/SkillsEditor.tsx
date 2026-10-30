"use client";

import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  KNOWN_SKILLS,
  SKILL_CATEGORIES,
  SKILL_LEVELS,
  type SkillCategory,
  type SkillLevel,
} from "@/lib/profile/schema";
import {
  EDITOR_VISIBLE,
  collapse,
  currentFragment,
  groupSkills,
  levelBars,
  levelCounts,
  parseSkillInput,
  replaceFragment,
  suggestSkills,
  yearsLabel,
} from "@/lib/profile/skills-view";
import { cn } from "@/lib/utils";

type T = Dictionary["pv2"];

export interface EditableSkill {
  _k: number;
  name: string;
  level: SkillLevel;
  years: string;
  category: SkillCategory;
}

const fill = (s: string, p: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => (k in p ? String(p[k]) : m));

/** 1–3 filled bars; the visual level cue that does not rely on colour alone. */
export function LevelBars({ level, className }: { level: SkillLevel; className?: string }) {
  const n = levelBars(level);
  return (
    <span aria-hidden className={cn("inline-flex h-3 items-end gap-[2px]", className)} data-level={level}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn("w-[3px] rounded-[1px]", i <= n ? "bg-current" : "bg-current opacity-20")}
          style={{ height: `${4 + i * 2.5}px` }}
        />
      ))}
    </span>
  );
}

const CHIP_TONE: Record<SkillLevel, string> = {
  EXPERT: "border-primary/45 bg-primary/10 text-foreground",
  GOOD: "border-border bg-card text-foreground",
  BASIC: "border-border border-dashed bg-transparent text-foreground/80",
};

/**
 * Profile skills editor: add field (autocomplete + voice), skills as compact chips grouped by
 * category (strongest first, long groups collapse), and a bottom sheet for name/level/years/category/
 * delete — instead of ~6 inline controls per skill.
 */
export function SkillsEditor({
  t,
  id,
  skills,
  onAdd,
  onPatch,
  onRemove,
}: {
  t: T;
  id: string;
  skills: EditableSkill[];
  onAdd: (names: string[]) => void;
  onPatch: (index: number, v: Partial<EditableSkill>) => void;
  onRemove: (index: number) => void;
}) {
  const u = t.skillsUi;
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");
  const [editKey, setEditKey] = useState<number | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [recent, setRecent] = useState<Set<number>>(() => new Set());
  const names = useMemo(() => skills.map((s) => s.name), [skills]);
  const groups = useMemo(() => groupSkills(skills), [skills]);
  const counts = useMemo(() => levelCounts(skills), [skills]);
  const suggestions = useMemo(() => suggestSkills(currentFragment(draft), KNOWN_SKILLS, names), [draft, names]);
  const editIndex = editKey == null ? -1 : skills.findIndex((s) => s._k === editKey);
  const editing = editIndex >= 0 ? skills[editIndex] : null;
  const inputId = `${id}-newskill`;

  const add = (text: string) => {
    const fresh = parseSkillInput(text, names);
    if (!fresh.length) {
      if (text.trim()) setStatus(u.exists);
      return;
    }
    onAdd(fresh);
    // keep just-added chips visible even when their group is collapsed
    setRecent((r) => new Set([...r, ...fresh.map((n) => hash(n))]));
    setStatus(fill(u.added, { names: fresh.join(", ") }));
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-5" data-testid="skills-editor">
      {/* ── add ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label htmlFor={inputId} className="sr-only">
            {t.addSkill}
          </label>
          <input
            id={inputId}
            dir="auto"
            className="input min-w-0 flex-1"
            placeholder={u.addPh}
            autoComplete="off"
            enterKeyHint="done"
            aria-describedby={`${id}-skills-addhint`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(draft);
              }
            }}
            data-testid="skill-add-input"
          />
          <VoiceInputButton targetId={inputId} compact testId="skill-voice" />
          <Button
            type="button"
            variant="outline"
            onClick={() => add(draft)}
            aria-label={t.addSkill}
            className="shrink-0"
          >
            <Plus data-icon="inline-start" />
            <span className="hidden sm:inline">{t.addSkill}</span>
          </Button>
        </div>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" data-testid="skill-suggestions">
            <span className="text-muted-foreground text-xs">{u.suggestions}:</span>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  const next = replaceFragment(draft, s);
                  add(next);
                }}
                className="bg-muted hover:bg-muted/70 focus-visible:ring-primary/40 inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-medium outline-none focus-visible:ring-3"
              >
                <Plus className="size-3.5" aria-hidden />
                <bdi>{s}</bdi>
              </button>
            ))}
          </div>
        )}
        <p id={`${id}-skills-addhint`} className="text-muted-foreground text-xs">
          {u.addMany}
        </p>
        <p role="status" aria-live="polite" className="sr-only">
          {status}
        </p>
      </div>

      {skills.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t.empty}</p>
      ) : (
        <>
          {/* ── legend + hint ── */}
          <div className="bg-muted/50 flex flex-col gap-2 rounded-lg px-3 py-2.5" data-testid="skills-legend">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
              <span className="text-muted-foreground font-semibold">{u.legend}:</span>
              {[...SKILL_LEVELS].reverse().map((lv) => (
                <span key={lv} className="inline-flex items-center gap-1.5">
                  <span className={cn("inline-flex h-6 items-center rounded-full border px-2", CHIP_TONE[lv])}>
                    <LevelBars level={lv} />
                  </span>
                  {t.levels[lv]}
                  <span className="text-muted-foreground font-mono">{counts[lv]}</span>
                </span>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">{u.hint}</p>
          </div>

          {/* ── grouped chips ── */}
          <div className="flex flex-col gap-4">
            {groups.map(({ category, items }) => {
              const isOpen = open.has(category);
              const { shown, hidden } = collapse(items, EDITOR_VISIBLE, isOpen, (x) => recent.has(hash(x.skill.name)));
              const listId = `${id}-sk-${category}`;
              return (
                <section key={category} aria-labelledby={`${listId}-h`} className="flex flex-col gap-2">
                  <h3 id={`${listId}-h`} className="kicker flex items-center gap-2">
                    {t.categories[category]}
                    <span className="font-normal tracking-normal">{items.length}</span>
                  </h3>
                  <ul id={listId} className="flex flex-wrap gap-2">
                    {shown.map(({ skill: s }) => {
                      const y = yearsLabel(s.years);
                      return (
                        <li key={s._k} className="max-w-full min-w-0" data-skill-item>
                          <button
                            type="button"
                            data-skill-chip
                            aria-haspopup="dialog"
                            aria-label={`${fill(u.editOf, { name: s.name })} · ${t.levels[s.level]}${y ? ` · ${fill(u.yearsShort, { n: y })}` : ""}`}
                            onClick={() => setEditKey(s._k)}
                            className={cn(
                              "focus-visible:ring-primary/40 hover:border-foreground/40 inline-flex min-h-11 max-w-full min-w-0 items-center gap-2 rounded-full border ps-3.5 pe-3 text-sm transition-colors outline-none focus-visible:ring-3",
                              CHIP_TONE[s.level],
                            )}
                          >
                            <bdi className="truncate font-semibold">{s.name}</bdi>
                            <LevelBars level={s.level} className="text-foreground/70 shrink-0" />
                            {y && (
                              <span className="text-muted-foreground shrink-0 font-mono text-xs">
                                {fill(u.yearsShort, { n: y })}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                    {(hidden > 0 || isOpen) && items.length > EDITOR_VISIBLE + 1 && (
                      <li>
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-controls={listId}
                          onClick={() =>
                            setOpen((o) => {
                              const n = new Set(o);
                              if (n.has(category)) n.delete(category);
                              else n.add(category);
                              return n;
                            })
                          }
                          className="text-muted-foreground hover:text-foreground focus-visible:ring-primary/40 inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold outline-none focus-visible:ring-3"
                          data-testid={`skills-more-${category}`}
                        >
                          {isOpen ? u.less : fill(u.more, { n: hidden })}
                          <ChevronDown
                            className={cn("size-4 transition-transform", isOpen && "rotate-180")}
                            aria-hidden
                          />
                        </button>
                      </li>
                    )}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}

      {/* ── edit sheet ── */}
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditKey(null)}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="pb-[max(1rem,env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-lg sm:rounded-t-xl sm:border-x"
          data-testid="skill-sheet"
        >
          {editing && (
            <>
              <SheetHeader className="pb-0">
                <SheetTitle>{u.edit}</SheetTitle>
                <SheetDescription>
                  <bdi>{editing.name || "—"}</bdi>
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4">
                <div>
                  <label className="label" htmlFor={`${id}-edit-name`}>
                    {t.skillName}
                  </label>
                  <input
                    id={`${id}-edit-name`}
                    dir="auto"
                    className="input font-semibold"
                    maxLength={60}
                    value={editing.name}
                    onChange={(e) => onPatch(editIndex, { name: e.target.value })}
                  />
                </div>
                <div>
                  <span className="label" id={`${id}-edit-level`}>
                    {t.level}
                  </span>
                  <div
                    role="radiogroup"
                    aria-labelledby={`${id}-edit-level`}
                    className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1"
                  >
                    {SKILL_LEVELS.map((lv) => (
                      <button
                        key={lv}
                        type="button"
                        role="radio"
                        aria-checked={editing.level === lv}
                        onClick={() => onPatch(editIndex, { level: lv })}
                        className="aria-checked:bg-foreground aria-checked:text-background focus-visible:ring-primary/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-3"
                      >
                        <LevelBars level={lv} />
                        {t.levels[lv]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-[7rem_1fr] gap-3">
                  <div>
                    <label className="label" htmlFor={`${id}-edit-years`}>
                      {t.years}
                    </label>
                    <input
                      id={`${id}-edit-years`}
                      className="input font-mono"
                      dir="ltr"
                      type="number"
                      min={0}
                      max={45}
                      step={0.5}
                      inputMode="decimal"
                      placeholder={u.yearsHint}
                      value={editing.years}
                      onChange={(e) => onPatch(editIndex, { years: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`${id}-edit-cat`}>
                      {t.category}
                    </label>
                    <select
                      id={`${id}-edit-cat`}
                      className="select-native"
                      value={editing.category}
                      onChange={(e) => onPatch(editIndex, { category: e.target.value as SkillCategory })}
                    >
                      {SKILL_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {t.categories[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    onRemove(editIndex);
                    setEditKey(null);
                  }}
                  data-testid="skill-delete"
                >
                  <Trash2 data-icon="inline-start" />
                  {u.delete}
                </Button>
                <Button type="button" className="ms-auto min-w-28" onClick={() => setEditKey(null)}>
                  {u.done}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** cheap stable key for "recently added" names (keys from the parent aren't known synchronously). */
function hash(name: string) {
  let h = 0;
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}
