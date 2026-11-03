"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import { savePrep } from "@/app/prep/actions";
import type { PrepStrings } from "@/lib/i18n/prep";
import { newId, type PrepQuestion, type PrepStage } from "@/lib/prep/plan";

const selectCls = "border-input bg-background h-9 rounded-md border px-2 text-sm";

export interface PrepEditorProps {
  s: PrepStrings;
  locale: string;
  applicationId: string;
  stagesSource: "saved" | "mine" | "official" | "default";
  initial: { stages: PrepStage[]; storyIds: string[]; topics: string[]; questions: PrepQuestion[] };
  stageKinds: Array<{ value: string; label: string }>;
  topics: Array<{ key: string; name: string; href: string; kind: "ds" | "pattern" }>;
  suggestedTopics: string[];
  stories: Array<{ id: string; label: string; preview: string }>;
  suggestedStoryIds: string[];
}

export function PrepEditor(p: PrepEditorProps) {
  const { s } = p;
  const [stages, setStages] = useState(p.initial.stages);
  const [storyIds, setStoryIds] = useState(p.initial.storyIds);
  const [topics, setTopics] = useState(p.initial.topics);
  const [questions, setQuestions] = useState(p.initial.questions);
  const [q, setQ] = useState("");
  const qRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = () => setMsg(null);

  const patchStage = (id: string, patch: Partial<PrepStage>) => {
    dirty();
    setStages((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };
  const move = (i: number, d: -1 | 1) => {
    dirty();
    setStages((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const out = [...xs];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });
  };
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => {
    dirty();
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  };
  const addQuestion = () => {
    const text = q.trim();
    if (text.length < 3) return;
    dirty();
    setQuestions((xs) => [...xs, { id: newId("q"), text, done: false }]);
    setQ("");
  };
  const save = () =>
    start(async () => {
      const r = await savePrep({ applicationId: p.applicationId, stages, storyIds, topics, questions });
      setMsg("ok" in r ? s.saved : s.saveError);
    });

  return (
    <>
      <section className="card flex flex-col gap-3" aria-labelledby="prep-stages" data-testid="prep-stages">
        <div>
          <h2 id="prep-stages" className="font-heading text-lg font-bold">
            {s.stagesTitle}
          </h2>
          <p className="text-muted-foreground text-xs" data-testid="prep-stages-source">
            {s.stagesFrom[p.stagesSource]}
          </p>
        </div>
        <ol className="flex flex-col gap-3">
          {stages.map((st, i) => (
            <li key={st.id} className="flex flex-col gap-2 rounded-md border p-3" data-testid="prep-stage">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground w-5 text-sm font-bold">{i + 1}.</span>
                <select
                  className={selectCls}
                  value={st.kind}
                  aria-label={s.debriefStage}
                  onChange={(e) => patchStage(st.id, { kind: e.target.value })}
                >
                  {p.stageKinds.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
                <Input
                  className="min-w-40 flex-1"
                  value={st.title}
                  maxLength={120}
                  dir="auto"
                  aria-label={s.stageTitle}
                  onChange={(e) => patchStage(st.id, { title: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-1">
                  {s.stageDate}
                  <Input
                    type="date"
                    className="w-40"
                    value={st.date ?? ""}
                    onChange={(e) => patchStage(st.id, { date: e.target.value || null })}
                  />
                </label>
                <label className="flex items-center gap-1 font-semibold">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={st.done}
                    onChange={(e) => patchStage(st.id, { done: e.target.checked })}
                  />
                  {s.stageDone}
                </label>
                <span className="ms-auto flex gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => move(i, -1)} aria-label={s.moveUp}>
                    <ArrowUp className="size-4" aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => move(i, 1)} aria-label={s.moveDown}>
                    <ArrowDown className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={s.removeStage}
                    onClick={() => {
                      dirty();
                      setStages((xs) => xs.filter((x) => x.id !== st.id));
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </span>
              </div>
              <Input
                value={st.note}
                maxLength={1000}
                dir="auto"
                placeholder={s.stageNote}
                aria-label={s.stageNote}
                onChange={(e) => patchStage(st.id, { note: e.target.value })}
              />
            </li>
          ))}
        </ol>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={stages.length >= 15}
          data-testid="prep-add-stage"
          onClick={() => {
            dirty();
            const kind = p.stageKinds.find((k) => k.value === "technical") ?? p.stageKinds[0];
            setStages((xs) => [
              ...xs,
              { id: newId("s"), kind: kind.value, title: kind.label, date: null, done: false, note: "" },
            ]);
          }}
        >
          <Plus className="size-4" aria-hidden />
          {s.addStage}
        </Button>
      </section>

      <section className="card flex flex-col gap-3" aria-labelledby="prep-stories" data-testid="prep-stories">
        <div>
          <h2 id="prep-stories" className="font-heading text-lg font-bold">
            {s.storiesTitle}
          </h2>
          <p className="text-muted-foreground text-xs">{s.storiesHint}</p>
        </div>
        {p.stories.length === 0 ? (
          <p className="text-sm">
            {s.storiesEmpty}{" "}
            <Link
              href="/learn/problem-solving/stories"
              className="text-primary font-semibold underline-offset-4 hover:underline"
            >
              {s.storiesWrite}
            </Link>
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {p.stories.map((st) => (
              <li key={st.id}>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 size-4"
                    checked={storyIds.includes(st.id)}
                    onChange={() => toggle(storyIds, setStoryIds, st.id)}
                    data-testid="prep-story"
                  />
                  <span>
                    <span className="font-semibold" dir="ltr">
                      {st.label}
                    </span>
                    {p.suggestedStoryIds.includes(st.id) && (
                      <span className="bg-primary/10 text-primary ms-2 rounded px-1.5 text-xs font-bold">
                        {s.suggested}
                      </span>
                    )}
                    {st.preview && (
                      <span className="text-muted-foreground block" dir="auto">
                        {st.preview}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card flex flex-col gap-3" aria-labelledby="prep-topics" data-testid="prep-topics">
        <div>
          <h2 id="prep-topics" className="font-heading text-lg font-bold">
            {s.topicsTitle}
          </h2>
          <p className="text-muted-foreground text-xs">{s.topicsHint}</p>
        </div>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {p.topics.map((t) => (
            <li key={t.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={topics.includes(t.key)}
                onChange={() => toggle(topics, setTopics, t.key)}
                aria-label={t.name}
                data-testid="prep-topic"
              />
              <Link href={t.href} className="text-primary font-semibold underline-offset-4 hover:underline" dir="ltr">
                {t.name}
              </Link>
              <span className="text-muted-foreground text-xs">{t.kind === "ds" ? s.dsLabel : s.patternLabel}</span>
              {p.suggestedTopics.includes(t.key) && (
                <span className="bg-primary/10 text-primary rounded px-1.5 text-xs font-bold">{s.suggested}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card flex flex-col gap-3" aria-labelledby="prep-questions" data-testid="prep-questions">
        <h2 id="prep-questions" className="font-heading text-lg font-bold">
          {s.questionsTitle}
        </h2>
        <ul className="flex flex-col gap-2">
          {questions.map((x) => (
            <li key={x.id} className="flex items-start gap-2 text-sm" data-testid="prep-question">
              <input
                type="checkbox"
                className="mt-1 size-4"
                checked={x.done}
                aria-label={s.asked}
                onChange={(e) => {
                  dirty();
                  setQuestions((xs) => xs.map((y) => (y.id === x.id ? { ...y, done: e.target.checked } : y)));
                }}
              />
              <span className={x.done ? "text-muted-foreground flex-1 line-through" : "flex-1"} dir="auto">
                {x.text}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={s.removeStage}
                onClick={() => {
                  dirty();
                  setQuestions((xs) => xs.filter((y) => y.id !== x.id));
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <Input
            ref={qRef}
            value={q}
            maxLength={300}
            dir="auto"
            placeholder={s.questionPh}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addQuestion();
              }
            }}
            data-testid="prep-question-input"
          />
          <VoiceInputButton
            locale={p.locale}
            onText={(v) => setQ(v)}
            getValue={() => qRef.current?.value ?? ""}
            maxLength={300}
            compact
            testId="prep-question-voice"
          />
          <Button type="button" variant="outline" size="sm" onClick={addQuestion} data-testid="prep-question-add">
            {s.addQuestion}
          </Button>
        </div>
      </section>

      <div className="bg-background/95 sticky bottom-[calc(var(--bottom-nav-h,0px)+env(safe-area-inset-bottom)+0.5rem)] z-10 flex items-center gap-3 rounded-md border p-2 shadow-sm backdrop-blur md:bottom-2">
        <Button type="button" onClick={save} disabled={pending} data-testid="prep-save">
          {pending ? s.saving : s.save}
        </Button>
        {msg && (
          <span className="text-sm font-semibold" role="status" data-testid="prep-save-msg">
            {msg}
          </span>
        )}
      </div>
    </>
  );
}
