"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import { saveRankingPrefs } from "@/app/jobs/ranking/actions";
import {
  COMPANY_TYPES,
  DEFAULT_WEIGHTS,
  EMPLOYMENT_TYPES,
  EMPTY_PREFS,
  MAX_KEYWORD_LENGTH,
  MAX_KEYWORDS,
  MAX_SALARY,
  MAX_WEIGHT,
  splitKeywords,
  WEIGHT_KEYS,
  type RankingPrefs,
  type WeightKey,
} from "@/lib/ranking/personal";
import { INDUSTRIES } from "@/lib/ranking/criteria";
import { normalizeSearchText } from "@/lib/search/text";
import { fillR, type RankingStrings } from "@/lib/i18n/ranking";
import { cn } from "@/lib/utils";

type Status = "idle" | "saved" | "error";

/** A text box + mic + add button that turns "a, b, c" into keywords. */
function KeywordAdder({
  id,
  placeholder,
  addLabel,
  onAdd,
  disabled,
  testId,
}: {
  id: string;
  placeholder: string;
  addLabel: string;
  onAdd: (words: string[]) => void;
  disabled?: boolean;
  testId: string;
}) {
  const [text, setText] = useState("");
  const ref = useRef(text);
  ref.current = text;
  const add = () => {
    const words = splitKeywords(text);
    if (words.length) onAdd(words);
    setText("");
  };
  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        placeholder={placeholder}
        maxLength={MAX_KEYWORD_LENGTH * 4}
        dir="auto"
        className="min-h-11 flex-1"
        disabled={disabled}
        data-testid={`${testId}-input`}
      />
      <VoiceInputButton
        onText={setText}
        getValue={() => ref.current}
        maxLength={MAX_KEYWORD_LENGTH * 4}
        compact
        disabled={disabled}
        testId={`${testId}-voice`}
      />
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        onClick={add}
        disabled={disabled || !text.trim()}
        data-testid={`${testId}-add`}
      >
        <Plus data-icon="inline-start" aria-hidden />
        {addLabel}
      </Button>
    </div>
  );
}

function Segmented({
  value,
  options,
  onChange,
  label,
  testId,
}: {
  value: number;
  options: { value: number; label: string }[];
  onChange: (v: number) => void;
  label: string;
  testId: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="bg-muted inline-flex flex-wrap rounded-md p-0.5"
      data-testid={testId}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-9 rounded px-2.5 text-xs font-medium transition-colors sm:text-sm",
            value === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Multi-select chips (toggle buttons). */
function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
  names,
  testId,
}: {
  options: readonly T[];
  value: T[];
  onChange: (v: T[]) => void;
  label: string;
  names: Record<T, string>;
  testId: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5" data-testid={testId}>
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={cn(
              "min-h-9 rounded-full border px-3 text-xs font-medium transition-colors sm:text-sm",
              on ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {names[o]}
          </button>
        );
      })}
    </div>
  );
}

/** Criteria whose preference comes from the profile (shown as a hint with a link). */
const FROM_PROFILE: readonly WeightKey[] = [
  "salary",
  "seniority",
  "tech",
  "location",
  "commute",
  "workMode",
  "companySize",
];

export function RankingForm({
  initial,
  s,
  hints = {},
}: {
  initial: RankingPrefs;
  s: RankingStrings;
  hints?: Partial<Record<WeightKey, string>>;
}) {
  const [prefs, setPrefs] = useState<RankingPrefs>(initial);
  const [status, setStatus] = useState<Status>("idle");
  const [pending, start] = useTransition();
  const key = (t: string) => normalizeSearchText(t);
  const change = (p: RankingPrefs) => {
    setPrefs(p);
    setStatus("idle");
  };

  const addInclude = (words: string[]) => {
    const have = new Set(prefs.include.map((k) => key(k.term)));
    const fresh = words.filter((w) => !have.has(key(w))).map((term) => ({ term, weight: 1, must: false }));
    const exclude = prefs.exclude.filter((x) => !words.some((w) => key(w) === key(x)));
    change({ ...prefs, include: [...prefs.include, ...fresh].slice(0, MAX_KEYWORDS), exclude });
  };
  const addExclude = (words: string[]) => {
    const have = new Set([...prefs.exclude, ...prefs.include.map((k) => k.term)].map(key));
    const fresh = words.filter((w) => !have.has(key(w)));
    change({ ...prefs, exclude: [...prefs.exclude, ...fresh].slice(0, MAX_KEYWORDS) });
  };
  const setInclude = (i: number, patch: Partial<RankingPrefs["include"][number]>) =>
    change({ ...prefs, include: prefs.include.map((k, j) => (j === i ? { ...k, ...patch } : k)) });
  const setWeight = (k: WeightKey, v: number) => change({ ...prefs, weights: { ...prefs.weights, [k]: v } });
  const setOn = (k: WeightKey, on: boolean) =>
    change({
      ...prefs,
      off: on ? prefs.off.filter((x) => x !== k) : [...prefs.off, k],
      weights: on && !prefs.weights[k] ? { ...prefs.weights, [k]: DEFAULT_WEIGHTS[k] } : prefs.weights,
    });
  const [resetNote, setResetNote] = useState(false);
  const reset = () => {
    // Keywords stay; every criterion back on at its default importance, preferences back to "from profile".
    change({ ...EMPTY_PREFS, include: prefs.include, exclude: prefs.exclude, defaultSort: prefs.defaultSort });
    setResetNote(true);
  };
  const extra = (k: WeightKey) => {
    switch (k) {
      case "salary":
        return (
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span>{s.salaryLabel}</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_SALARY}
              step={1000}
              dir="ltr"
              className="min-h-11 w-36"
              placeholder={hints.salary || s.salaryPlaceholder}
              value={prefs.salaryMin ?? ""}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value));
                change({ ...prefs, salaryMin: e.target.value && n > 0 ? Math.min(MAX_SALARY, n) : null });
              }}
              data-testid="salary-min"
            />
          </label>
        );
      case "domain":
        return (
          <Chips
            options={INDUSTRIES}
            value={prefs.industries}
            onChange={(v) => change({ ...prefs, industries: v })}
            label={s.industriesLabel}
            names={s.industries}
            testId="industries"
          />
        );
      case "employment":
        return (
          <div className="flex flex-col gap-1">
            <Chips
              options={EMPLOYMENT_TYPES}
              value={prefs.employment}
              onChange={(v) => change({ ...prefs, employment: v })}
              label={s.employmentLabel}
              names={s.employment}
              testId="employment"
            />
            {!prefs.employment.length && <p className="text-muted-foreground text-xs">{s.employmentDefault}</p>}
          </div>
        );
      case "companySize":
        return (
          <div className="flex flex-col gap-1">
            <Chips
              options={COMPANY_TYPES}
              value={prefs.companyTypes}
              onChange={(v) => change({ ...prefs, companyTypes: v })}
              label={s.companyTypesLabel}
              names={s.companyTypes}
              testId="company-types"
            />
            {!prefs.companyTypes.length && <p className="text-muted-foreground text-xs">{s.companyTypesDefault}</p>}
          </div>
        );
      default:
        return null;
    }
  };
  const hintFor = (k: WeightKey) => {
    if (!FROM_PROFILE.includes(k)) return null;
    if (k === "salary" && prefs.salaryMin) return null;
    if (k === "companySize" && prefs.companyTypes.length) return null;
    const v = hints[k];
    return (
      <p className="text-muted-foreground text-xs">
        {v ? (
          <>
            {fillR(s.fromProfile, { v: "" })}
            <bdi>{v}</bdi>
          </>
        ) : (
          s.notSet
        )}{" "}
        ·{" "}
        <Link href="/profile" className="text-primary underline-offset-4 hover:underline">
          {s.editProfile}
        </Link>
      </p>
    );
  };

  const save = () =>
    start(async () => {
      const r = await saveRankingPrefs(prefs);
      if (r.ok) {
        setPrefs(r.prefs);
        setStatus("saved");
      } else setStatus("error");
    });

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <section className="flex flex-col gap-3" aria-labelledby="inc-h">
        <div>
          <h2 id="inc-h" className="text-lg font-bold">
            {s.include}
          </h2>
          <p className="text-muted-foreground text-sm">{s.includeHint}</p>
        </div>
        <KeywordAdder
          id="inc"
          placeholder={s.includePlaceholder}
          addLabel={s.add}
          onAdd={addInclude}
          testId="inc"
          disabled={prefs.include.length >= MAX_KEYWORDS}
        />
        {prefs.include.length > 0 && (
          <ul className="divide-border flex flex-col divide-y rounded-md border" data-testid="inc-list">
            {prefs.include.map((k, i) => (
              <li key={k.term} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2" data-testid="inc-item">
                <span className="min-w-0 flex-1 font-semibold break-words" dir="auto">
                  {k.term}
                </span>
                <Segmented
                  label={`${s.weight}: ${k.term}`}
                  value={k.weight}
                  onChange={(v) => setInclude(i, { weight: v })}
                  options={[1, 2, 3].map((v) => ({ value: v, label: s.weightLabels[v] }))}
                  testId="inc-weight"
                />
                <label className="inline-flex min-h-11 items-center gap-1.5 text-sm" title={s.mustHint}>
                  <input
                    type="checkbox"
                    className="accent-primary size-4"
                    checked={k.must}
                    onChange={(e) => setInclude(i, { must: e.target.checked })}
                    data-testid="inc-must"
                  />
                  {s.must}
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={fillR(s.remove, { term: k.term })}
                  onClick={() => change({ ...prefs, include: prefs.include.filter((_, j) => j !== i) })}
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted-foreground text-xs">{s.mustHint}</p>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="exc-h">
        <div>
          <h2 id="exc-h" className="text-lg font-bold">
            {s.exclude}
          </h2>
          <p className="text-muted-foreground text-sm">{s.excludeHint}</p>
        </div>
        <KeywordAdder
          id="exc"
          placeholder={s.excludePlaceholder}
          addLabel={s.add}
          onAdd={addExclude}
          testId="exc"
          disabled={prefs.exclude.length >= MAX_KEYWORDS}
        />
        {prefs.exclude.length > 0 && (
          <ul className="flex flex-wrap gap-2" data-testid="exc-list">
            {prefs.exclude.map((x) => (
              <li key={x} className="chip inline-flex items-center gap-1 ps-2.5" dir="auto">
                {x}
                <button
                  type="button"
                  className="hover:text-destructive inline-grid size-8 place-items-center"
                  aria-label={fillR(s.remove, { term: x })}
                  onClick={() => change({ ...prefs, exclude: prefs.exclude.filter((y) => y !== x) })}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="w-h">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="w-h" className="text-lg font-bold">
              {s.criteriaTitle}
            </h2>
            <p className="text-muted-foreground text-sm">{s.criteriaLead}</p>
          </div>
          <Button type="button" variant="outline" className="min-h-11" onClick={reset} data-testid="ranking-reset">
            {s.reset}
          </Button>
        </div>
        {resetNote && (
          <p className="text-muted-foreground text-sm" role="status" data-testid="reset-note">
            {s.resetDone}
          </p>
        )}
        <ul className="divide-border flex flex-col divide-y rounded-md border" data-testid="criteria-list">
          {WEIGHT_KEYS.map((k) => {
            const on = !prefs.off.includes(k) && prefs.weights[k] > 0;
            return (
              <li
                key={k}
                className={cn("flex flex-col gap-2 px-3 py-3", !on && "opacity-70")}
                data-testid={`criterion-${k}`}
              >
                <div className="flex items-start gap-3">
                  <label className="flex min-h-11 flex-1 cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      role="switch"
                      aria-checked={on}
                      className="accent-primary mt-1 size-5 shrink-0"
                      checked={on}
                      onChange={(e) => setOn(k, e.target.checked)}
                      data-testid={`toggle-${k}`}
                    />
                    <span>
                      <span className="block font-semibold">{s.weightNames[k]}</span>
                      <span className="text-muted-foreground block text-xs">{s.weightHelp[k]}</span>
                    </span>
                  </label>
                </div>
                {on && (
                  <div className="flex flex-col gap-2 ps-7">
                    <Segmented
                      label={`${s.weight}: ${s.weightNames[k]}`}
                      value={prefs.weights[k]}
                      onChange={(v) => setWeight(k, v)}
                      options={Array.from({ length: MAX_WEIGHT }, (_, i) => ({
                        value: i + 1,
                        label: s.weightLevels[i + 1],
                      }))}
                      testId={`weight-${k}`}
                    />
                    {extra(k)}
                    {hintFor(k)}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-muted-foreground bg-muted/60 rounded-md p-3 text-xs">{s.honest}</p>
      </section>

      <label className="flex min-h-11 items-start gap-2.5">
        <input
          type="checkbox"
          className="accent-primary mt-1 size-4"
          checked={prefs.defaultSort}
          onChange={(e) => change({ ...prefs, defaultSort: e.target.checked })}
          data-testid="default-sort"
        />
        <span>{s.defaultSort}</span>
      </label>

      <div className="bg-background/95 sticky bottom-[calc(var(--bottom-nav-h,0px)+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center gap-3 border-t py-3">
        <Button type="submit" disabled={pending} className="min-h-11" data-testid="ranking-save">
          {pending ? s.saving : s.save}
        </Button>
        <span
          role="status"
          aria-live="polite"
          className={cn("text-sm", status === "error" ? "text-destructive" : "text-muted-foreground")}
          data-testid="ranking-status"
        >
          {status === "saved" ? s.saved : status === "error" ? s.error : ""}
        </span>
        <Link
          href="/jobs?sort=personal"
          className="text-primary ms-auto text-sm font-medium underline-offset-4 hover:underline"
          data-testid="ranking-preview"
        >
          {s.preview}
        </Link>
      </div>
    </form>
  );
}
