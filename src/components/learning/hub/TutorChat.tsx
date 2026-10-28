"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Bot, Plus, SendHorizontal, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fmt } from "@/lib/i18n/learning";
import type { LearningHubStrings } from "@/lib/i18n/learning-hub";
import { TUTOR_MAX_CHARS } from "@/lib/learning/tutor-limits";
import type { Stage } from "@/lib/learning/types";
import { cn } from "@/lib/utils";
import { MiniMarkdown } from "./MiniMarkdown";

type Meta = { threadId?: string; remaining?: number | null };
export type TutorMessage = UIMessage<Meta>;

function textOf(m: TutorMessage): string {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

function errorText(err: Error | undefined, t: LearningHubStrings): string | null {
  if (!err) return null;
  let body: { error?: string; reason?: string } = {};
  try {
    body = JSON.parse(err.message);
  } catch {
    body = { error: err.message };
  }
  if (body.error === "secret") return t.tutorSecret;
  if (body.error === "limit")
    return body.reason === "burst" ? t.tutorBurst : (t.tutorLimits[body.reason ?? ""] ?? t.tutorError);
  if (body.error && t.tutorLimits[body.error]) return t.tutorLimits[body.error];
  return t.tutorError;
}

export function TutorChat({
  skill,
  stage,
  initialThreadId,
  initialMessages,
  initialRemaining,
  offline,
  draft,
  onDraftUsed,
  t,
}: {
  skill: string;
  stage: Stage;
  initialThreadId: string | null;
  initialMessages: TutorMessage[];
  initialRemaining: number | null;
  offline: boolean;
  draft: string | null;
  onDraftUsed: () => void;
  t: LearningHubStrings;
}) {
  const threadRef = useRef<string | null>(initialThreadId);
  const [remaining, setRemaining] = useState<number | null>(initialRemaining);
  const [input, setInput] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [transport] = useState(
    () =>
      new DefaultChatTransport<TutorMessage>({
        api: "/api/learn/tutor",
        prepareSendMessagesRequest: ({ messages }) => {
          const last = messages[messages.length - 1];
          return { body: { threadId: threadRef.current ?? undefined, skill, stage, text: last ? textOf(last) : "" } };
        },
      }),
  );
  const { messages, sendMessage, status, stop, setMessages, error, clearError } = useChat<TutorMessage>({
    id: `tutor-${skill}-${stage}`,
    messages: initialMessages,
    transport,
  });
  const busy = status === "submitted" || status === "streaming";

  // Thread id + remaining quota arrive as metadata on the assistant message's start part.
  useEffect(() => {
    const last = [...messages].reverse().find((m) => m.role === "assistant" && m.metadata);
    if (last?.metadata?.threadId) threadRef.current = last.metadata.threadId;
    if (last?.metadata && last.metadata.remaining !== undefined) setRemaining(last.metadata.remaining ?? null);
  }, [messages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (draft) {
      setInput(draft);
      onDraftUsed();
      inputRef.current?.focus();
    }
  }, [draft, onDraftUsed]);

  const send = (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    if (clean.length > TUTOR_MAX_CHARS) return setLocalError(fmt(t.tutorTooLong, { n: TUTOR_MAX_CHARS }));
    setLocalError(null);
    clearError();
    setInput("");
    void sendMessage({ text: clean });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const reset = () => {
    stop();
    threadRef.current = null;
    setMessages([]);
    clearError();
    setLocalError(null);
  };

  const err = localError ?? errorText(error, t);
  const outOfQuota = remaining === 0;

  return (
    <section aria-labelledby="tutor-title" className="bg-card flex min-w-0 flex-col rounded-xl border">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="bg-accent text-accent-foreground grid size-9 shrink-0 place-items-center rounded-lg">
            <Bot className="size-[1.1rem]" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-col">
            <h2 id="tutor-title" className="leading-tight font-bold">
              {t.tutorTitle}
            </h2>
            <p className="text-muted-foreground text-xs">
              {offline ? t.tutorOffline : remaining != null ? fmt(t.tutorRemaining, { n: remaining }) : t.tutorLead}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-10 rounded-full"
          onClick={reset}
          disabled={!messages.length}
        >
          <Plus className="size-4" aria-hidden />
          {t.tutorNew}
        </Button>
      </header>

      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-busy={busy}
        aria-label={t.tutorTitle}
        className="flex max-h-[60vh] min-h-64 flex-col gap-3 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4"
      >
        {messages.length === 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm leading-relaxed">{t.tutorLead}</p>
            <div className="flex flex-wrap gap-2">
              {t.starters.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy || outOfQuota}
                  onClick={() => send(s)}
                  className="hover:bg-secondary min-h-10 rounded-full border px-3 text-start text-sm transition-colors disabled:opacity-60"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => {
          const mine = m.role === "user";
          const text = textOf(m);
          if (!text && !mine) return null;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-start" : "justify-end")}>
              <div
                className={cn(
                  "max-w-[92%] min-w-0 rounded-2xl px-3.5 py-2.5 text-[0.95rem] leading-relaxed [overflow-wrap:anywhere] sm:max-w-[85%]",
                  mine
                    ? "bg-primary text-primary-foreground rounded-ss-sm whitespace-pre-wrap"
                    : "bg-secondary rounded-se-sm",
                )}
                dir="auto"
              >
                <span className="sr-only">{mine ? t.tutorYou : t.tutorBot}: </span>
                {mine ? text : <MiniMarkdown text={text} />}
              </div>
            </div>
          );
        })}
        {status === "submitted" && (
          <p className="text-muted-foreground flex items-center gap-2 self-end text-sm">
            <span className="flex gap-1" aria-hidden>
              <span className="bg-foreground/40 size-1.5 rounded-full motion-safe:animate-pulse" />
              <span className="bg-foreground/40 size-1.5 rounded-full [animation-delay:150ms] motion-safe:animate-pulse" />
              <span className="bg-foreground/40 size-1.5 rounded-full [animation-delay:300ms] motion-safe:animate-pulse" />
            </span>
            {t.tutorThinking}
          </p>
        )}
      </div>

      <p role="alert" className="text-destructive px-4 pb-2 text-sm empty:hidden">
        {err ?? (outOfQuota ? t.tutorLimits.user_daily : null)}
      </p>

      <form onSubmit={submit} className="flex items-end gap-2 border-t p-3">
        <label htmlFor="tutor-input" className="sr-only">
          {t.tutorPlaceholder}
        </label>
        <Textarea
          id="tutor-input"
          ref={inputRef}
          dir="auto"
          rows={2}
          value={input}
          maxLength={TUTOR_MAX_CHARS + 200}
          placeholder={t.tutorPlaceholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(input);
            }
          }}
          className="max-h-40 min-h-11 flex-1 resize-y text-[0.95rem]"
        />
        {busy ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0 rounded-full"
            onClick={() => stop()}
          >
            <Square className="size-4" aria-hidden />
            <span className="sr-only">{t.tutorStop}</span>
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            className="size-11 shrink-0 rounded-full"
            disabled={!input.trim() || outOfQuota}
          >
            <SendHorizontal className="size-4 rtl:rotate-180" aria-hidden />
            <span className="sr-only">{t.tutorSend}</span>
          </Button>
        )}
      </form>
    </section>
  );
}
