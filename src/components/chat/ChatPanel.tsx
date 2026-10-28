"use client";

import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { History, Maximize2, MessageSquareText, Plus, SendHorizontal, Sparkles, Square, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CHAT_MAX_CHARS } from "@/lib/chat/limits";
import type { ChatToolOutput } from "@/lib/chat/types";
import { chatStrings, type ChatStrings } from "@/lib/i18n/chat";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { ChatToolCard } from "./ChatCards";
import { ChatMarkdown } from "./ChatMarkdown";

type Meta = { threadId?: string; remaining?: number | null; offline?: boolean };
export type ChatUIMessage = UIMessage<Meta>;
type ThreadRow = { id: string; title: string; updatedAt: string };

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

function textOf(m: ChatUIMessage): string {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

type ToolPart = { type: string; toolCallId?: string; state?: string; output?: unknown };
const isToolPart = (p: { type: string }): p is ToolPart => p.type.startsWith("tool-");

function errorText(err: Error | undefined, s: ChatStrings): string | null {
  if (!err) return null;
  let body: { error?: string; reason?: string } = {};
  try {
    body = JSON.parse(err.message);
  } catch {
    body = { error: err.message };
  }
  if (body.error === "secret") return s.secret;
  if (body.error === "limit") return body.reason === "burst" ? s.burst : (s.limits[body.reason ?? ""] ?? s.error);
  if (body.error && s.limits[body.error]) return s.limits[body.error];
  return s.error;
}

/** The side sheet unmounts when closed; remember its thread for this tab so reopening continues it. */
const SHEET_THREAD_KEY = "jh-chat-thread";

export function ChatPanel({
  locale,
  variant = "page",
  initialThreadId,
  onNavigate,
  onClose,
}: {
  locale: Locale;
  variant?: "page" | "sheet";
  initialThreadId?: string | null;
  /** Called when the user follows a link inside the chat (the sheet closes itself). */
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const s = chatStrings(locale);
  const t = dictionaries[locale];
  const threadRef = useRef<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const [threads, setThreads] = useState<ThreadRow[] | null>(null);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [input, setInput] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [transport] = useState(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => {
          const last = messages[messages.length - 1];
          return { body: { threadId: threadRef.current ?? undefined, text: last ? textOf(last) : "" } };
        },
      }),
  );

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/threads", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { threads: ThreadRow[]; offline?: boolean };
      setThreads(body.threads);
      if (body.offline !== undefined) setOffline(body.offline);
    } catch {
      // history is optional
    }
  }, []);

  const { messages, sendMessage, status, stop, setMessages, error, clearError } = useChat<ChatUIMessage>({
    id: "job-hunt-chat",
    transport,
    onFinish: () => void loadThreads(),
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  // Resume: /chat?thread=… or the sheet's last thread in this tab.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    let id = initialThreadId ?? null;
    if (!id && variant === "sheet") {
      try {
        id = sessionStorage.getItem(SHEET_THREAD_KEY);
      } catch {
        id = null;
      }
    }
    if (id) void openThread(id, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (variant !== "sheet") return;
    try {
      if (threadId) sessionStorage.setItem(SHEET_THREAD_KEY, threadId);
      else sessionStorage.removeItem(SHEET_THREAD_KEY);
    } catch {
      // private mode
    }
  }, [threadId, variant]);

  useEffect(() => {
    const last = [...messages].reverse().find((m) => m.role === "assistant" && m.metadata);
    const meta = last?.metadata;
    if (meta?.threadId && meta.threadId !== threadRef.current) {
      threadRef.current = meta.threadId;
      setThreadId(meta.threadId);
    }
    if (meta && meta.remaining !== undefined) setRemaining(meta.remaining ?? null);
    if (meta?.offline !== undefined) setOffline(meta.offline);
  }, [messages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const send = (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    if (clean.length > CHAT_MAX_CHARS) return setLocalError(fill(s.tooLong, { n: CHAT_MAX_CHARS }));
    setLocalError(null);
    clearError();
    setInput("");
    setView("chat");
    void sendMessage({ text: clean });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const reset = () => {
    stop();
    threadRef.current = null;
    setThreadId(null);
    setMessages([]);
    clearError();
    setLocalError(null);
    setView("chat");
    inputRef.current?.focus();
  };

  async function openThread(id: string, quiet = false) {
    stop();
    clearError();
    setLocalError(null);
    try {
      const res = await fetch(`/api/chat/threads/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!res.ok) {
        if (quiet) return;
        throw new Error(String(res.status));
      }
      const body = (await res.json()) as { id: string; messages: ChatUIMessage[] };
      threadRef.current = body.id;
      setThreadId(body.id);
      setMessages(body.messages);
      setView("chat");
    } catch {
      if (!quiet) setLocalError(s.error);
    }
  }

  const removeThread = async (id: string) => {
    const res = await fetch(`/api/chat/threads/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      setThreads((ts) => ts?.filter((x) => x.id !== id) ?? null);
      if (threadRef.current === id) reset();
    }
  };

  const err = localError ?? errorText(error, s);
  const outOfQuota = remaining === 0 && !offline;
  const lastAssistantId = useMemo(() => [...messages].reverse().find((m) => m.role === "assistant")?.id, [messages]);

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "short" }),
    [locale],
  );

  return (
    <section
      aria-labelledby={`chat-title-${variant}`}
      data-chat-busy={busy ? "true" : undefined}
      className={cn(
        "bg-card flex min-h-0 min-w-0 flex-col",
        variant === "page"
          ? "h-[calc(100dvh-var(--header-h)-var(--bottom-nav-h)-env(safe-area-inset-bottom)-3rem)] min-h-[26rem] rounded-xl border md:h-[calc(100dvh-var(--header-h)-6rem)]"
          : "h-full",
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="bg-accent text-accent-foreground grid size-9 shrink-0 place-items-center rounded-lg">
            <Sparkles className="size-[1.1rem]" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-col">
            <h2 id={`chat-title-${variant}`} className="truncate leading-tight font-bold">
              {s.title}
            </h2>
            <p data-chat-remaining className="text-muted-foreground truncate text-xs">
              {offline ? s.offline : remaining != null ? fill(s.remaining, { n: remaining }) : s.readOnlyShort}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant={view === "history" ? "secondary" : "ghost"}
            size="icon"
            className="size-10 rounded-full"
            aria-pressed={view === "history"}
            onClick={() => setView((v) => (v === "history" ? "chat" : "history"))}
            title={s.history}
          >
            <History className="size-4" aria-hidden />
            <span className="sr-only">{s.history}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 rounded-full"
            onClick={reset}
            disabled={!messages.length && view === "chat"}
            title={s.newChat}
          >
            <Plus className="size-4" aria-hidden />
            <span className="sr-only">{s.newChat}</span>
          </Button>
          {variant === "sheet" && (
            <Button asChild variant="ghost" size="icon" className="size-10 rounded-full" title={s.openFull}>
              <Link href={threadId ? `/chat?thread=${encodeURIComponent(threadId)}` : "/chat"} onClick={onNavigate}>
                <Maximize2 className="size-4" aria-hidden />
                <span className="sr-only">{s.openFull}</span>
              </Link>
            </Button>
          )}
          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 rounded-full"
              onClick={onClose}
              title={s.close}
            >
              <X className="size-4" aria-hidden />
              <span className="sr-only">{s.close}</span>
            </Button>
          )}
        </div>
      </header>

      {view === "history" ? (
        <nav aria-label={s.history} className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          <h3 className="kicker px-2 py-2 text-[0.65rem]">{s.history}</h3>
          {threads === null ? (
            <p className="text-muted-foreground px-2 text-sm">{s.loading}</p>
          ) : threads.length === 0 ? (
            <p className="text-muted-foreground px-2 text-sm">{s.noHistory}</p>
          ) : (
            <ul className="flex flex-col">
              {threads.map((th) => (
                <li key={th.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void openThread(th.id)}
                    aria-current={th.id === threadId ? "true" : undefined}
                    className={cn(
                      "hover:bg-muted flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-start text-sm",
                      th.id === threadId && "bg-muted font-semibold",
                    )}
                  >
                    <MessageSquareText className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate" dir="auto">
                      {th.title}
                    </span>
                    <time dateTime={th.updatedAt} className="text-muted-foreground shrink-0 font-mono text-[0.7rem]">
                      {dateFmt.format(new Date(th.updatedAt))}
                    </time>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive size-10 shrink-0 rounded-full"
                    onClick={() => void removeThread(th.id)}
                    title={s.deleteThread}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    <span className="sr-only">
                      {s.deleteThread}: {th.title}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </nav>
      ) : (
        <div
          ref={listRef}
          role="log"
          data-chat-log
          aria-live="polite"
          aria-busy={busy}
          aria-label={s.title}
          className="scroll-thin flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4"
        >
          {messages.length === 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm leading-relaxed">{s.lead}</p>
              <p className="text-muted-foreground text-xs leading-relaxed">{s.readOnly}</p>
              <div className="flex flex-col gap-2" role="list" aria-label={s.startersLabel}>
                {s.starters.map((q) => (
                  <button
                    key={q}
                    type="button"
                    role="listitem"
                    disabled={busy || outOfQuota}
                    onClick={() => send(q)}
                    dir="auto"
                    className="hover:bg-secondary min-h-11 w-full rounded-xl border px-3 py-2 text-start text-sm transition-colors disabled:opacity-60"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => {
            const mine = m.role === "user";
            if (mine)
              return (
                <div key={m.id} data-role="user" className="flex justify-start">
                  <div
                    dir="auto"
                    className="bg-primary text-primary-foreground max-w-[92%] min-w-0 rounded-2xl rounded-ss-sm px-3.5 py-2.5 text-[0.95rem] leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap sm:max-w-[85%]"
                  >
                    <span className="sr-only">{s.you}: </span>
                    {textOf(m)}
                  </div>
                </div>
              );
            const pending =
              m.id === lastAssistantId &&
              busy &&
              m.parts.some((p) => isToolPart(p) && p.state !== "output-available" && p.state !== "output-error");
            return (
              <div key={m.id} data-role="assistant" className="flex min-w-0 flex-col items-stretch gap-2">
                {m.parts.map((p, i) => {
                  if (p.type === "text") {
                    if (!p.text.trim()) return null;
                    return (
                      <div
                        key={i}
                        dir="auto"
                        className="bg-secondary max-w-[92%] min-w-0 self-end rounded-2xl rounded-se-sm px-3.5 py-2.5 text-[0.95rem] leading-relaxed [overflow-wrap:anywhere] sm:max-w-[85%]"
                      >
                        <span className="sr-only">{s.bot}: </span>
                        <ChatMarkdown text={p.text} onNavigate={onNavigate} />
                      </div>
                    );
                  }
                  if (isToolPart(p) && p.state === "output-available" && p.output)
                    return (
                      <ChatToolCard
                        key={p.toolCallId ?? i}
                        out={p.output as ChatToolOutput}
                        t={t}
                        s={s}
                        locale={locale}
                        onNavigate={onNavigate}
                      />
                    );
                  return null;
                })}
                {pending && <Dots label={s.searching} />}
              </div>
            );
          })}
          {status === "submitted" && <Dots label={s.thinking} />}
        </div>
      )}

      <p role="alert" className="text-destructive px-4 pb-2 text-sm empty:hidden">
        {err ?? (outOfQuota ? s.limits.user_daily : null)}
      </p>

      <form
        onSubmit={submit}
        className={cn(
          "flex items-end gap-2 border-t p-3",
          variant === "sheet" && "pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
        )}
      >
        <label htmlFor={`chat-input-${variant}`} className="sr-only">
          {s.placeholder}
        </label>
        <Textarea
          id={`chat-input-${variant}`}
          ref={inputRef}
          dir="auto"
          rows={1}
          value={input}
          maxLength={CHAT_MAX_CHARS + 200}
          placeholder={s.placeholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(input);
            }
          }}
          className="max-h-36 min-h-11 min-w-0 flex-1 resize-none text-base sm:text-[0.95rem]"
        />
        <VoiceInputButton
          targetRef={inputRef}
          locale={locale}
          compact={variant === "sheet"}
          disabled={busy || outOfQuota}
          testId={`chat-voice-${variant}`}
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
            <span className="sr-only">{s.stop}</span>
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            className="size-11 shrink-0 rounded-full"
            disabled={!input.trim() || outOfQuota}
          >
            <SendHorizontal className="size-4 rtl:rotate-180" aria-hidden />
            <span className="sr-only">{s.send}</span>
          </Button>
        )}
      </form>
    </section>
  );
}

function Dots({ label }: { label: string }) {
  return (
    <p className="text-muted-foreground flex items-center gap-2 self-end text-sm">
      <span className="flex gap-1" aria-hidden>
        <span className="bg-foreground/40 size-1.5 rounded-full motion-safe:animate-pulse" />
        <span className="bg-foreground/40 size-1.5 rounded-full [animation-delay:150ms] motion-safe:animate-pulse" />
        <span className="bg-foreground/40 size-1.5 rounded-full [animation-delay:300ms] motion-safe:animate-pulse" />
      </span>
      {label}
    </p>
  );
}
