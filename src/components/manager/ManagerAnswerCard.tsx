"use client";

import { Check, Circle, Loader2, Save, Sparkles } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { polishManagerAnswer, saveManagerAnswer, type ManagerView } from "@/app/prep/manager/actions";
import { CopyButton } from "@/components/outreach/CopyButton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ManagerStrings } from "@/lib/i18n/manager";
import {
  SIGNAL_LABEL,
  STAR_FIELDS,
  STAR_MAX,
  checkSignals,
  isEmptyStar,
  starTemplate,
  type SignalId,
  type StarFields,
} from "@/lib/manager/bank";
import { cn } from "@/lib/utils";

export function ManagerAnswerCard({
  questionId,
  signals,
  initial,
  s,
  lang,
}: {
  questionId: string;
  signals: SignalId[];
  initial: ManagerView | null;
  s: ManagerStrings;
  lang: "he" | "en";
}) {
  const [f, setF] = useState<StarFields>({
    situation: initial?.situation ?? "",
    task: initial?.task ?? "",
    action: initial?.action ?? "",
    result: initial?.result ?? "",
  });
  const [polished, setPolished] = useState<{ text: string; source: string } | null>(
    initial?.polished ? { text: initial.polished, source: initial.polishedSource ?? "template" } : null,
  );
  const [savedF, setSavedF] = useState(f);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "polish" | null>(null);
  const [, start] = useTransition();
  const checks = useMemo(() => checkSignals(f, signals), [f, signals]);
  const dirty = STAR_FIELDS.some((k) => f[k] !== savedF[k]);
  const answer = polished && !dirty ? polished.text : starTemplate(f, lang);
  const empty = isEmptyStar(f);

  const save = () =>
    start(async () => {
      setBusy("save");
      setMsg(null);
      try {
        const r = await saveManagerAnswer({ questionId, ...f });
        if (r.ok) {
          setSavedF(f);
          setPolished(r.view.polished ? { text: r.view.polished, source: r.view.polishedSource ?? "template" } : null);
          setMsg(s.saved);
        } else setMsg(r.error === "empty" ? s.empty : s.error);
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
        const saved = await saveManagerAnswer({ questionId, ...f });
        if (!saved.ok) return setMsg(saved.error === "empty" ? s.empty : s.error);
        setSavedF(f);
        const r = await polishManagerAnswer(questionId, lang);
        if (r.ok) {
          setPolished({ text: r.view.polished ?? "", source: r.view.polishedSource ?? "template" });
          setMsg(r.limited ?? (r.rejected ? s.rejected : null));
        } else setMsg(s.error);
      } catch {
        setMsg(s.error);
      } finally {
        setBusy(null);
      }
    });

  return (
    <div className="flex flex-col gap-3" data-testid={`mgr-card-${questionId}`}>
      <div className="grid gap-2 md:grid-cols-2">
        {STAR_FIELDS.map((k) => (
          <label key={k} className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="font-medium">{s.fields[k]}</span>
            <Textarea
              dir="auto"
              rows={3}
              maxLength={STAR_MAX}
              value={f[k]}
              placeholder={s.placeholders[k]}
              onChange={(e) => setF((p) => ({ ...p, [k]: e.target.value }))}
              className="min-w-0 text-sm"
              data-testid={`mgr-${k}`}
            />
          </label>
        ))}
      </div>
      <div>
        <p className="text-sm font-bold">{s.signals}</p>
        <ul className="mt-1 flex flex-wrap gap-1.5" data-testid="mgr-signals">
          {checks.map((c) => (
            <li
              key={c.id}
              data-ok={c.ok}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                c.ok ? "border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950" : "bg-card text-muted-foreground",
              )}
            >
              {c.ok ? <Check className="size-3" aria-hidden /> : <Circle className="size-3" aria-hidden />}
              {SIGNAL_LABEL[c.id][lang]}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-1 text-xs">{s.signalHint}</p>
      </div>
      {!empty && (
        <div className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-3">
          <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
            {s.answer}
            <span
              className="bg-card rounded-full border px-2 py-0.5 text-xs font-normal"
              data-testid="mgr-answer-source"
            >
              {polished && !dirty && polished.source === "ai" ? s.answerAi : s.answerTemplate}
            </span>
          </p>
          <p dir="auto" className="text-sm leading-relaxed break-words whitespace-pre-line" data-testid="mgr-answer">
            {answer}
          </p>
          <div>
            <CopyButton text={answer} label={s.copy} copiedLabel={s.copied} />
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={save} disabled={busy !== null || empty} data-testid="mgr-save">
          {busy === "save" ? (
            <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />
          ) : (
            <Save data-icon="inline-start" aria-hidden />
          )}
          {s.save}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={polish}
          disabled={busy !== null || empty}
          data-testid="mgr-polish"
        >
          {busy === "polish" ? (
            <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />
          ) : (
            <Sparkles data-icon="inline-start" aria-hidden />
          )}
          {s.polish}
        </Button>
        {msg && (
          <span role="status" className="text-sm" data-testid="mgr-msg">
            {msg}
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-xs">{s.polishNote}</p>
    </div>
  );
}
