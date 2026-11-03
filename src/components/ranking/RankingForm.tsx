"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import { saveRankingPrefs } from "@/app/jobs/ranking/actions";
import {
  MAX_KEYWORD_LENGTH,
  MAX_KEYWORDS,
  MAX_WEIGHT,
  splitKeywords,
  WEIGHT_KEYS,
  type RankingPrefs,
  type WeightKey,
} from "@/lib/ranking/personal";
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

export function RankingForm({ initial, s }: { initial: RankingPrefs; s: RankingStrings }) {
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
        <h2 id="w-h" className="text-lg font-bold">
          {s.weightsTitle}
        </h2>
        <ul className="flex flex-col gap-4">
          {WEIGHT_KEYS.map((k) => (
            <li key={k} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{s.weightNames[k]}</p>
                <p className="text-muted-foreground text-xs">{s.weightHelp[k]}</p>
              </div>
              <Segmented
                label={s.weightNames[k]}
                value={prefs.weights[k]}
                onChange={(v) => setWeight(k, v)}
                options={Array.from({ length: MAX_WEIGHT + 1 }, (_, v) => ({ value: v, label: s.weightLevels[v] }))}
                testId={`weight-${k}`}
              />
            </li>
          ))}
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

      <div className="bg-background/95 sticky bottom-0 flex flex-wrap items-center gap-3 border-t py-3">
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
