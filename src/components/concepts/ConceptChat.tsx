"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownWideNarrow,
  Baby,
  Bot,
  Bug,
  Factory,
  GitCompare,
  Loader2,
  SendHorizontal,
} from "lucide-react";
import { askConcept, type ConceptMessageDTO } from "@/app/learn/concepts/actions";
import { MiniMarkdown } from "@/components/learning/hub/MiniMarkdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import { CHAT_MAX, type ConceptAction, type DrillAction } from "@/lib/concepts/core";
import type { ConceptStrings } from "@/lib/i18n/concepts";
import { fmt } from "@/lib/i18n/learning";
import { cn } from "@/lib/utils";

const ICONS: Record<DrillAction, typeof Bot> = {
  deeper: ArrowDownWideNarrow,
  simpler: Baby,
  example: Factory,
  mistakes: Bug,
  compare: GitCompare,
};

export function ConceptChat({
  id,
  initial,
  t,
  locale,
  refreshOnReply = false,
}: {
  id: string;
  /** NEW concepts move to LEARNING on the first answer — refresh so the header/status reflect it. */
  refreshOnReply?: boolean;
  initial: ConceptMessageDTO[];
  t: ConceptStrings;
  locale: string;
}) {
  const router = useRouter();
  const refreshed = useRef(false);
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [compareWith, setCompareWith] = useState("");
  const [showCompare, setShowCompare] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<ConceptAction | null>(null);
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
  }, [messages.length, busy]);

  function ask(action: ConceptAction, value = "") {
    setNotice(null);
    setBusy(action);
    start(async () => {
      const r = await askConcept({ id, action, text: value }).catch(() => null);
      setBusy(null);
      if (!r) return setNotice(t.errorGeneric);
      if (!r.ok) return setNotice(r.error === "secret" ? t.secretBlocked : t.errorGeneric);
      setMessages((m) => [...m, ...r.messages]);
      if (refreshOnReply && !refreshed.current) {
        refreshed.current = true;
        router.refresh();
      }
      if (r.notice) setNotice(r.notice);
      if (action === "chat") setText("");
      if (action === "compare") {
        setCompareWith("");
        setShowCompare(false);
      }
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (text.trim()) ask("chat", text);
  }

  const label = (m: ConceptMessageDTO) =>
    m.action === "chat"
      ? m.content
      : m.action === "compare" && m.content
        ? fmt(t.comparedWith, { x: m.content })
        : t.actions[m.action];

  return (
    <section aria-labelledby="drill" className="flex flex-col gap-4" data-testid="concept-chat">
      <div className="flex flex-col gap-2">
        <h2 id="drill" className="text-xl font-bold">
          {t.drillTitle}
        </h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ICONS) as DrillAction[]).map((a) => {
            const Icon = ICONS[a];
            return (
              <Button
                key={a}
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={busy !== null}
                aria-expanded={a === "compare" ? showCompare : undefined}
                onClick={() => (a === "compare" ? setShowCompare((v) => !v) : ask(a))}
                data-testid={`drill-${a}`}
              >
                {busy === a ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Icon className="size-4" aria-hidden />
                )}
                {t.actions[a]}
              </Button>
            );
          })}
        </div>
        {showCompare && (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (compareWith.trim()) ask("compare", compareWith);
            }}
          >
            <Input
              value={compareWith}
              onChange={(e) => setCompareWith(e.target.value)}
              placeholder={t.comparePlaceholder}
              maxLength={80}
              dir="auto"
              className="h-10 min-w-0 flex-1"
              autoFocus
            />
            <Button type="submit" size="sm" className="rounded-full" disabled={busy !== null || !compareWith.trim()}>
              {t.compareGo}
            </Button>
          </form>
        )}
      </div>

      <div className="bg-card flex flex-col gap-3 rounded-2xl border p-3 sm:p-4">
        <h3 className="kicker">{t.chatTitle}</h3>
        {messages.length === 0 && !busy ? (
          <p className="text-muted-foreground text-sm">{t.chatEmpty}</p>
        ) : (
          <ol className="flex flex-col gap-3" aria-live="polite">
            {messages.map((m) =>
              m.role === "user" ? (
                <li
                  key={m.id}
                  className="bg-primary text-primary-foreground max-w-[85%] self-end rounded-2xl rounded-ee-sm px-3.5 py-2 text-sm"
                >
                  <span dir="auto" className="whitespace-pre-wrap">
                    {label(m)}
                  </span>
                </li>
              ) : (
                <li
                  key={m.id}
                  className="bg-secondary/60 flex max-w-full flex-col gap-1.5 self-start rounded-2xl rounded-es-sm px-3.5 py-2.5 sm:max-w-[92%]"
                >
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-semibold">
                    <Bot className="size-3.5" aria-hidden />
                    {t.tutor}
                    {m.source && m.source !== "ai" && (
                      <span className="bg-caution-soft text-caution rounded-full px-1.5 py-0.5">
                        {m.source === "limited" ? t.replyLimited : t.replyOffline}
                      </span>
                    )}
                    <time className="font-normal" dateTime={m.createdAt}>
                      {new Date(m.createdAt).toLocaleString(locale === "en" ? "en-GB" : "he-IL", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </time>
                  </span>
                  <div className="text-[0.95rem] leading-relaxed" dir="auto">
                    <MiniMarkdown text={m.content} />
                  </div>
                </li>
              ),
            )}
            {busy && (
              <li className="text-muted-foreground inline-flex items-center gap-2 self-start text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t.thinking}
              </li>
            )}
          </ol>
        )}
        <div ref={endRef} />
        {notice && (
          <p role="status" className="bg-caution-soft/60 flex items-start gap-2 rounded-lg p-2.5 text-sm">
            <AlertTriangle className="text-caution mt-0.5 size-4 shrink-0" aria-hidden />
            {notice}
          </p>
        )}
        <form onSubmit={submit} className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (text.trim() && !busy) ask("chat", text);
              }
            }}
            maxLength={CHAT_MAX}
            rows={2}
            placeholder={t.chatPlaceholder}
            aria-label={t.chatPlaceholder}
            dir="auto"
            className={cn("min-h-11 min-w-0 flex-1 resize-none")}
            data-testid="concept-chat-input"
          />
          <VoiceInputButton
            targetRef={inputRef}
            maxLength={CHAT_MAX}
            disabled={busy !== null}
            testId="concept-chat-voice"
          />
          <Button
            type="submit"
            size="icon"
            className="size-11 shrink-0 rounded-full"
            disabled={busy !== null || !text.trim()}
          >
            <SendHorizontal className="size-4 rtl:rotate-180" aria-hidden />
            <span className="sr-only">{t.send}</span>
          </Button>
        </form>
      </div>
    </section>
  );
}
