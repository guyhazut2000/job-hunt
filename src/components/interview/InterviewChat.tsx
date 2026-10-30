"use client";

import { AlertTriangle, Flag, Loader2, SendHorizontal, SkipForward, UserRound, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { answerAction, finishAction, skipAction, type TurnResult } from "@/app/interview/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import type { InterviewStrings } from "@/lib/i18n/interview";
import { fmt } from "@/lib/i18n/learning";
import { MAX_ANSWER_CHARS } from "@/lib/interview/flow";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "interviewer" | "candidate";
  kind: "question" | "followup" | "answer" | "skip";
  content: string;
  questionIndex: number;
}

type Busy = "send" | "skip" | "finish" | null;

export function InterviewChat({
  id,
  messages,
  total,
  questionIndex,
  focus,
  lang,
  t,
}: {
  id: string;
  messages: ChatMessage[];
  total: number;
  questionIndex: number;
  /** What a strong answer to the current question shows. */
  focus: string;
  lang: "he" | "en";
  t: InterviewStrings;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [, start] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    inputRef.current?.focus();
  }, [messages.length]);

  function run(kind: Exclude<Busy, null>, call: () => Promise<TurnResult>) {
    setNotice(null);
    setBusy(kind);
    start(async () => {
      const r = await call().catch(() => null);
      if (!r || !r.ok) {
        setBusy(null);
        setPendingText(null);
        setNotice(r?.error ?? t.error);
        return;
      }
      if (kind === "send") setText("");
      router.refresh();
      setBusy(null);
      setPendingText(null);
    });
  }

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setPendingText(value);
    run("send", () => answerAction(id, value));
  }

  const progress = Math.round(((questionIndex + 1) / Math.max(1, total)) * 100);

  return (
    <section className="flex flex-col gap-4" data-testid="interview-chat">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 text-sm font-semibold">
          <span data-testid="interview-progress">{fmt(t.question, { n: questionIndex + 1, total })}</span>
          <span className="text-muted-foreground tabular-nums">{progress}%</span>
        </div>
        <div className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden>
          <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <ol className="flex flex-col gap-3" aria-live="polite" data-testid="interview-messages">
        {messages.map((m) => (
          <Bubble key={m.id} m={m} t={t} />
        ))}
        {pendingText && (
          <Bubble
            m={{ id: "pending", role: "candidate", kind: "answer", content: pendingText, questionIndex }}
            t={t}
            pending
          />
        )}
        {busy && (
          <li className="text-muted-foreground inline-flex items-center gap-2 self-start text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {busy === "finish" ? t.finishing : t.sending}
          </li>
        )}
      </ol>
      <div ref={endRef} />

      {focus && (
        <p className="bg-muted/60 text-muted-foreground rounded-lg px-3 py-2 text-xs" data-testid="interview-focus">
          {fmt(t.focus, { focus })}
        </p>
      )}

      {notice && (
        <p role="status" className="bg-caution-soft/60 flex items-start gap-2 rounded-lg p-2.5 text-sm">
          <AlertTriangle className="text-caution mt-0.5 size-4 shrink-0" aria-hidden />
          {notice}
        </p>
      )}

      <form onSubmit={submit} className="flex flex-col gap-2" data-print-hide>
        <label htmlFor="interview-answer" className="text-sm font-semibold">
          {t.answerLabel}
        </label>
        <div className="flex items-end gap-2">
          <Textarea
            id="interview-answer"
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            maxLength={MAX_ANSWER_CHARS}
            rows={4}
            placeholder={t.answerPlaceholder}
            dir="auto"
            className="min-h-24 min-w-0 flex-1"
            disabled={busy !== null}
            data-testid="interview-input"
          />
          <div className="flex flex-col gap-2">
            <VoiceInputButton
              targetRef={inputRef}
              maxLength={MAX_ANSWER_CHARS}
              locale={lang}
              disabled={busy !== null}
              testId="interview-voice"
            />
            <Button
              type="submit"
              size="icon"
              className="size-11 shrink-0 rounded-full"
              disabled={busy !== null || !text.trim()}
              data-testid="interview-send"
            >
              <SendHorizontal className="size-4 rtl:rotate-180" aria-hidden />
              <span className="sr-only">{t.send}</span>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 rounded-full"
            disabled={busy !== null}
            onClick={() => run("skip", () => skipAction(id))}
            data-testid="interview-skip"
          >
            <SkipForward className="size-4 rtl:rotate-180" aria-hidden />
            {t.skip}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 rounded-full"
            disabled={busy !== null}
            onClick={() => {
              if (window.confirm(t.confirmFinish)) run("finish", () => finishAction(id));
            }}
            data-testid="interview-finish"
          >
            <Flag className="size-4" aria-hidden />
            {t.finish}
          </Button>
        </div>
      </form>
    </section>
  );
}

function Bubble({ m, t, pending }: { m: ChatMessage; t: InterviewStrings; pending?: boolean }) {
  const mine = m.role === "candidate";
  return (
    <li
      className={cn("flex max-w-[92%] gap-2 sm:max-w-[80%]", mine ? "flex-row-reverse self-end" : "self-start")}
      data-testid={`interview-msg-${m.kind}`}
    >
      <span
        className={cn(
          "mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full",
          mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
        aria-hidden
      >
        {mine ? <UserRound className="size-4" /> : <Video className="size-4" />}
      </span>
      <div
        className={cn(
          "flex flex-col gap-1 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          mine ? "bg-primary/10" : "bg-card border-rule border",
          pending && "opacity-60",
        )}
      >
        <span className="text-muted-foreground text-xs font-semibold">
          {mine ? t.you : m.kind === "followup" ? `${t.interviewer} · ${t.followup}` : t.interviewer}
        </span>
        <p className="break-words whitespace-pre-line" dir="auto">
          {m.kind === "skip" ? <span className="text-muted-foreground italic">{t.skipped}</span> : m.content}
        </p>
      </div>
    </li>
  );
}
