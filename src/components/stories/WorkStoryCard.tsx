"use client";

import { BookOpenCheck, ChevronDown, Eye, EyeOff, Lightbulb, Loader2, Mic, Save, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { polishWorkStory, saveWorkStory } from "@/app/learn/problem-solving/stories/actions";
import { CopyButton } from "@/components/outreach/CopyButton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import type { StoryFields, StoryItemKind } from "@/lib/algo/industry";
import { fill, type StoryStrings } from "@/lib/i18n/stories";
import {
  filledCount,
  isEmptyStory,
  spokenSeconds,
  STORY_FIELD_MAX,
  STORY_FIELDS,
  templateAnswer,
  type StoryLang,
  type StoryView,
} from "@/lib/stories/story";
import { cn } from "@/lib/utils";

const EMPTY: StoryFields = { situation: "", built: "", why: "", result: "" };

/** Ready spoken answer for a saved story: the polished one, else built from the user's words. */
export function answerFor(story: StoryView | null, name: string, lang: StoryLang): string | null {
  if (!story || isEmptyStory(story.fields)) return null;
  return story.polished ?? templateAnswer(story.fields, name, lang);
}

/** Question → (answer out loud) → reveal. Used on cards and on the "My stories" page. */
export function PracticeReveal({
  question,
  answer,
  s,
  example = false,
}: {
  question: string;
  answer: string;
  s: StoryStrings;
  example?: boolean;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-3" data-testid="story-practice">
      <p className="text-muted-foreground text-xs">{s.practiceLead}</p>
      <p className="text-base font-bold">{question}</p>
      {shown ? (
        <div className="flex flex-col gap-2">
          {example && (
            <span className="bg-caution-soft text-caution w-fit rounded-full px-2 py-0.5 text-xs font-bold">
              {s.exampleBadge}
            </span>
          )}
          <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line" data-testid="story-practice-answer">
            {answer}
          </p>
        </div>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-fit"
        onClick={() => setShown((v) => !v)}
        data-testid="story-reveal"
      >
        {shown ? <EyeOff data-icon="inline-start" aria-hidden /> : <Eye data-icon="inline-start" aria-hidden />}
        {shown ? s.hide : s.reveal}
      </Button>
    </div>
  );
}

export function WorkStoryCard({
  kind,
  itemId,
  name,
  initial,
  example,
  signedIn,
  loginHref,
  lang,
  s,
}: {
  kind: StoryItemKind;
  itemId: string;
  name: string;
  initial: StoryView | null;
  example: StoryFields;
  signedIn: boolean;
  loginHref: string;
  lang: StoryLang;
  s: StoryStrings;
}) {
  const [story, setStory] = useState<StoryView | null>(initial);
  const [fields, setFields] = useState<StoryFields>(initial?.fields ?? EMPTY);
  const [open, setOpen] = useState(false);
  const [practice, setPractice] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "polish" | null>(null);
  const [, start] = useTransition();
  const valueRef = useRef(fields);
  valueRef.current = fields;

  const question = fill(s.storyQuestion, { name });
  const saved = story?.fields ?? EMPTY;
  const dirty = STORY_FIELDS.some((k) => fields[k].trim() !== saved[k].trim());
  const empty = isEmptyStory(fields);
  const answer = answerFor(story, name, lang);
  const exampleAnswer = templateAnswer(example, name, lang);
  const n = filledCount(story?.fields);
  const testBase = `story-${kind}-${itemId}`;

  const save = () =>
    start(async () => {
      if (empty) return setMsg(s.emptyNeedOne);
      setBusy("save");
      setMsg(null);
      try {
        const r = await saveWorkStory({ kind, itemId, ...fields });
        if (r.ok) {
          setStory(r.story);
          setMsg(s.saved);
        } else setMsg(r.error === "empty" ? s.emptyNeedOne : s.error);
      } catch {
        setMsg(s.error);
      } finally {
        setBusy(null);
      }
    });

  const polish = () =>
    start(async () => {
      setBusy("polish");
      setMsg(null);
      try {
        if (dirty) {
          const r = await saveWorkStory({ kind, itemId, ...fields });
          if (!r.ok) return setMsg(r.error === "empty" ? s.emptyNeedOne : s.error);
        }
        const r = await polishWorkStory(kind, itemId, lang);
        if (r.ok) {
          setStory(r.story);
          setFields(r.story.fields);
          setMsg(r.limited ?? (r.rejected ? s.aiRejected : null));
        } else setMsg(r.error === "empty" ? s.emptyNeedOne : s.error);
      } catch {
        setMsg(s.error);
      } finally {
        setBusy(null);
      }
    });

  return (
    <section
      className="border-fit/30 bg-fit-soft/30 flex flex-col gap-2 rounded-lg border border-dashed p-3"
      data-testid="work-story"
      data-story-id={testBase}
      data-filled={n}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-black">
          <BookOpenCheck className="text-fit size-4" aria-hidden />
          {s.storyTitle}
          {n > 0 && (
            <span className="bg-fit-soft text-fit rounded-full px-2 py-0.5 text-xs font-bold">
              {fill(s.filled, { n })}
            </span>
          )}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setPractice((v) => !v)}
            aria-pressed={practice}
            data-testid={`${testBase}-practice`}
          >
            <Mic data-icon="inline-start" aria-hidden />
            {s.practice}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={open ? "secondary" : "default"}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            data-testid={`${testBase}-toggle`}
          >
            <ChevronDown
              data-icon="inline-start"
              aria-hidden
              className={cn("transition-transform", open && "rotate-180")}
            />
            {open ? s.close : n > 0 ? s.edit : s.open}
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">{fill(s.storyLead, { name })}</p>

      {practice && <PracticeReveal question={question} answer={answer ?? exampleAnswer} s={s} example={!answer} />}

      {!open && answer && !practice && (
        <p dir="auto" className="text-foreground/80 line-clamp-3 text-sm leading-relaxed" data-testid="story-preview">
          {answer}
        </p>
      )}

      {open && (
        <div className="flex flex-col gap-3">
          {!signedIn && (
            <p className="text-sm">
              <Link href={loginHref} className="text-fit font-bold underline underline-offset-2">
                {s.signIn}
              </Link>
            </p>
          )}
          {STORY_FIELDS.map((k) => (
            <div key={k} className="flex flex-col gap-1">
              <label htmlFor={`${testBase}-${k}`} className="text-sm font-bold">
                {s[k]}
              </label>
              <div className="flex items-start gap-1.5">
                <Textarea
                  id={`${testBase}-${k}`}
                  value={fields[k]}
                  onChange={(e) => setFields((f) => ({ ...f, [k]: e.target.value }))}
                  maxLength={STORY_FIELD_MAX}
                  rows={2}
                  dir="auto"
                  placeholder={s.examplePrefix + example[k]}
                  disabled={!signedIn || busy !== null}
                  className="min-h-16 min-w-0 flex-1 text-sm placeholder:text-xs"
                  data-testid={`story-field-${k}`}
                />
                <VoiceInputButton
                  onText={(v) => setFields((f) => ({ ...f, [k]: v }))}
                  getValue={() => valueRef.current[k]}
                  maxLength={STORY_FIELD_MAX}
                  compact
                  disabled={!signedIn || busy !== null}
                  testId={`story-voice-${k}`}
                />
              </div>
            </div>
          ))}

          {empty && (
            <details className="bg-caution-soft/40 rounded-lg border p-2 text-sm" data-testid="story-example">
              <summary className="flex cursor-pointer items-center gap-1.5 font-bold">
                <Lightbulb className="text-caution size-4" aria-hidden />
                {s.exampleTitle}
              </summary>
              <p dir="auto" className="text-foreground/80 mt-2 leading-relaxed">
                <span className="bg-caution-soft text-caution me-1 rounded-full px-2 py-0.5 text-xs font-bold">
                  {s.exampleBadge}
                </span>
                {exampleAnswer}
              </p>
            </details>
          )}

          {signedIn && (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={save}
                  disabled={busy !== null || empty || !dirty}
                  data-testid="story-save"
                >
                  {busy === "save" ? (
                    <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
                  ) : (
                    <Save data-icon="inline-start" aria-hidden />
                  )}
                  {busy === "save" ? s.saving : s.save}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={polish}
                  disabled={busy !== null || empty}
                  data-testid="story-polish"
                >
                  {busy === "polish" ? (
                    <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
                  ) : (
                    <Sparkles data-icon="inline-start" aria-hidden />
                  )}
                  {busy === "polish" ? s.polishing : s.polish}
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">{s.polishLead}</p>
            </div>
          )}
          {msg && (
            <p role="status" className="text-sm font-semibold" data-testid="story-msg">
              {msg}
            </p>
          )}

          {answer && (
            <div className="bg-card flex flex-col gap-2 rounded-lg border p-3" data-testid="story-answer">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-bold">{fill(s.answerTitle, { sec: spokenSeconds(answer) })}</h4>
                <CopyButton text={answer} label={s.copy} copiedLabel={s.copied} variant="ghost" />
              </div>
              <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line">
                {answer}
              </p>
              <p className="text-muted-foreground text-xs">
                {story?.polishedSource === "ai" ? s.srcAi : s.srcTemplate}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
