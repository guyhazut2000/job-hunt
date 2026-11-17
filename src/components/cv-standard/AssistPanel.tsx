"use client";
/**
 * Per-step AI assist for the CV builder (docs/cv-ai-assist.md): import from the uploaded CVs,
 * improve wording, tailor to a target job (X-Y-Z bullets). Suggestions are previewed with
 * accept / edit / reject; accepting only changes the unsaved draft.
 */
import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, FileUp, Loader2, Pencil, Sparkles, Target, X } from "lucide-react";
import { assistImportAction, assistRewriteAction } from "@/app/cv/standard/assist-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AssistResult, Mode } from "@/lib/cv-assist/ai";
import { hasPlaceholder, suggestionLabel, type AssistStep, type Suggestion } from "@/lib/cv-assist/core";
import type { Draft } from "@/lib/cv-standard/draft";
import { cvAssistStrings } from "@/lib/i18n/cv-assist";
import { fillS } from "@/lib/i18n/cv-standard";

export interface TargetJobOption {
  id: string;
  title: string;
  company: string;
  score: number;
}

type A = ReturnType<typeof cvAssistStrings>;
type Action = { kind: "import" } | { kind: "rewrite"; mode: Mode; field?: "headline" | "summary" };
const actionKey = (a: Action) => (a.kind === "import" ? "import" : `${a.mode}-${a.field ?? "bullets"}`);

export function AssistPanel({
  locale,
  lang,
  step,
  draft,
  cvCount,
  targetJobs,
  jobId,
  onJob,
  onAccept,
}: {
  locale: "he" | "en";
  /** Language of the CV being built (AI writes in it). */
  lang: "he" | "en";
  step: AssistStep;
  draft: Draft;
  cvCount: number;
  targetJobs: TargetJobOption[];
  jobId: string;
  onJob: (id: string) => void;
  onAccept: (s: Suggestion, edited?: string) => void;
}) {
  const a = cvAssistStrings(locale);
  const [busy, setBusy] = useState<string | null>(null);
  const [res, setRes] = useState<(AssistResult & { cvs?: number }) | null>(null);
  const [items, setItems] = useState<Suggestion[]>([]);

  const run = async (act: Action) => {
    setBusy(actionKey(act));
    try {
      const r =
        act.kind === "import"
          ? await assistImportAction(step, draft)
          : await assistRewriteAction({ step, draft, mode: act.mode, field: act.field, jobId: jobId || null, lang });
      setRes(r);
      setItems(r.suggestions);
    } catch {
      setRes({ status: "error", source: "ai", suggestions: [], rejected: 0 });
      setItems([]);
    } finally {
      setBusy(null);
    }
  };
  const drop = (id: string) => setItems((xs) => xs.filter((x) => x.id !== id));

  const canRewrite = step === "summary" || step === "experience" || step === "projects";
  const btn = (act: Action, label: string, icon: React.ReactNode, testId: string, disabled = false) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => run(act)}
      disabled={!!busy || disabled}
      data-testid={testId}
    >
      {busy === actionKey(act) ? <Loader2 className="animate-spin" data-icon="inline-start" /> : icon}
      {busy === actionKey(act) ? a.working : label}
    </Button>
  );
  const imp = <FileUp data-icon="inline-start" />;
  const spark = <Sparkles data-icon="inline-start" />;
  const tgt = <Target data-icon="inline-start" />;

  return (
    <div
      className="bg-muted/40 flex flex-col gap-3 rounded-md border border-dashed p-3"
      data-testid={`cv-assist-${step}`}
    >
      <div className="flex flex-col gap-0.5">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles aria-hidden className="text-primary size-4" />
          {a.title}
        </p>
        <p className="text-muted-foreground text-xs">{a.lead}</p>
      </div>

      {canRewrite && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`cva-job-${step}`} className="text-xs">
            {a.target}
          </Label>
          {targetJobs.length ? (
            <select
              id={`cva-job-${step}`}
              value={jobId}
              onChange={(e) => onJob(e.target.value)}
              className="bg-background h-10 w-full max-w-md rounded-md border px-2 text-sm"
              data-testid="cv-assist-job"
            >
              <option value="">{a.targetAll}</option>
              {targetJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} · {j.company} ({j.score}%)
                </option>
              ))}
            </select>
          ) : (
            <p className="text-muted-foreground text-xs">{a.noJobs}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {cvCount > 0 ? (
          btn({ kind: "import" }, a.import, imp, "cv-assist-import")
        ) : (
          <p className="text-muted-foreground text-xs">
            {a.importNone}{" "}
            <Link href="/profile" className="text-primary font-semibold underline">
              {a.toUpload}
            </Link>
          </p>
        )}
        {(step === "experience" || step === "projects") && (
          <>
            {btn({ kind: "rewrite", mode: "improve" }, a.xyzImprove, spark, "cv-assist-improve")}
            {btn({ kind: "rewrite", mode: "tailor" }, a.xyzTailor, tgt, "cv-assist-tailor")}
          </>
        )}
      </div>
      {step === "summary" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {(["headline", "summary"] as const).map((f) => (
            <div key={f} className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold">{a[f]}</span>
              <div className="flex flex-wrap gap-2">
                {btn({ kind: "rewrite", mode: "improve", field: f }, a.improve, spark, `cv-assist-improve-${f}`)}
                {btn({ kind: "rewrite", mode: "tailor", field: f }, a.tailor, tgt, `cv-assist-tailor-${f}`)}
              </div>
            </div>
          ))}
        </div>
      )}
      {step === "skills" && (
        <Link href="/profile#suggested-skills" className="text-primary self-start text-xs font-semibold underline">
          {a.skillsLink}
        </Link>
      )}

      {res && (
        <ResultHeader
          a={a}
          res={res}
          count={items.length}
          onClear={() => setItems([])}
          onAcceptAll={() => {
            // Imports are verbatim copies of the user's own CV, so a bulk accept is safe; still draft-only.
            for (const s of items) onAccept(s);
            setItems([]);
          }}
        />
      )}
      {items.length > 0 && (
        <ul className="flex flex-col gap-2" data-testid="cv-assist-list">
          {items.map((s) => (
            <SuggestionCard
              key={s.id}
              a={a}
              s={s}
              onAccept={(edited) => {
                onAccept(s, edited);
                drop(s.id);
              }}
              onReject={() => drop(s.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultHeader({
  a,
  res,
  count,
  onClear,
  onAcceptAll,
}: {
  a: A;
  res: AssistResult & { cvs?: number };
  count: number;
  onClear: () => void;
  onAcceptAll: () => void;
}) {
  const notes: string[] = [];
  if (res.status === "limited") notes.push(a.limited);
  else if (res.status === "off") notes.push(a.off);
  else if (res.status === "error") notes.push(a.error);
  else if (res.source === "rules") notes.push(a.rules);
  if (res.rejected) notes.push(fillS(a.rejected, { n: res.rejected }));
  if (res.same) notes.push(a.same);
  if (res.empty) notes.push(a.empty);
  if (res.readBy === "ai") notes.push(a.readAi);
  else if (res.readBy === "rules") notes.push(a.readRules);
  return (
    <div
      className="flex flex-col gap-1.5 text-sm"
      role="status"
      data-testid="cv-assist-status"
      data-status={res.status}
      data-source={res.source}
    >
      {notes.map((n) => (
        <p key={n} className="text-muted-foreground text-xs">
          {n}
        </p>
      ))}
      {res.have && res.have.length > 0 && (
        <p className="text-xs">
          <span className="font-semibold">{a.have}</span> <bdi dir="ltr">{res.have.join(", ")}</bdi>
        </p>
      )}
      {res.missing && res.missing.length > 0 && (
        <p className="text-xs" data-testid="cv-assist-missing">
          <span className="font-semibold">{a.missing}</span> <bdi dir="ltr">{res.missing.join(", ")}</bdi>
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold" data-testid="cv-assist-count">
          {count
            ? fillS(a.results, { n: count })
            : res.status !== "ok" || res.empty || res.rejected || res.same
              ? ""
              : res.source === "import"
                ? a.importEmpty
                : a.none}
        </p>
        {count > 1 && (
          <div className="flex gap-1">
            {res.source === "import" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onAcceptAll}
                data-testid="cv-assist-accept-all"
              >
                {a.acceptAll}
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={onClear} data-testid="cv-assist-reject-all">
              {a.rejectAll}
            </Button>
          </div>
        )}
      </div>
      <p className="text-muted-foreground text-xs">{a.never}</p>
    </div>
  );
}

function SuggestionCard({
  a,
  s,
  onAccept,
  onReject,
}: {
  a: A;
  s: Suggestion;
  onAccept: (edited?: string) => void;
  onReject: () => void;
}) {
  const editable = s.kind === "field" || s.kind === "bullet" || s.kind === "skill";
  const initial = s.kind === "skill" ? s.name : "text" in s ? s.text : "";
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const kindLabel =
    s.kind === "field"
      ? a.fields[s.field]
      : s.kind === "bullet"
        ? s.replace == null
          ? a.newBullet
          : s.label
        : s.kind === "entry"
          ? a.newEntry
          : s.kind === "education"
            ? `${a.newEducation} · ${a.kinds[s.item.kind]}`
            : a.newSkill;
  const text = editing ? value : s.kind === "skill" ? s.name : suggestionLabel(s);
  const ph = hasPlaceholder(editing ? value : initial);
  return (
    <li
      className="bg-card flex flex-col gap-2 rounded-md border p-3 text-sm"
      data-testid="cv-assist-item"
      data-kind={s.kind}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{kindLabel}</Badge>
        {s.kind === "bullet" && s.replace == null && s.label ? (
          <span className="text-muted-foreground text-xs">{s.label}</span>
        ) : null}
        {s.from ? <span className="text-muted-foreground text-xs">{fillS(a.from, { file: s.from })}</span> : null}
      </div>
      {"before" in s && s.before && !editing ? (
        <p className="text-muted-foreground text-xs">
          {a.replaces} <bdi className="line-through">{s.before}</bdi>
        </p>
      ) : null}
      {editing ? (
        s.kind === "skill" ? (
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label={a.edit}
            data-testid="cv-assist-edit-input"
          />
        ) : (
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={s.kind === "field" && s.field === "summary" ? 5 : 3}
            aria-label={a.edit}
            data-testid="cv-assist-edit-input"
          />
        )
      ) : (
        <p className="font-medium whitespace-pre-line">
          <bdi>{text}</bdi>
        </p>
      )}
      {s.kind === "entry" && s.bullets.length > 0 && (
        <ul className="text-muted-foreground list-disc ps-5 text-xs">
          {s.bullets.map((b, i) => (
            <li key={i}>
              <bdi>{b}</bdi>
            </li>
          ))}
        </ul>
      )}
      {ph && (
        <p className="text-caution flex items-center gap-1.5 text-xs" data-testid="cv-assist-placeholder">
          <AlertTriangle aria-hidden className="size-3.5" />
          {a.placeholder}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <Button
              type="button"
              size="sm"
              onClick={() => onAccept(value)}
              disabled={!value.trim()}
              data-testid="cv-assist-accept-edit"
            >
              <Check data-icon="inline-start" />
              {a.editDone}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => (setEditing(false), setValue(initial))}>
              {a.cancel}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" size="sm" onClick={() => onAccept()} data-testid="cv-assist-accept">
              <Check data-icon="inline-start" />
              {a.accept}
            </Button>
            {editable && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
                data-testid="cv-assist-edit"
              >
                <Pencil data-icon="inline-start" />
                {a.edit}
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={onReject} data-testid="cv-assist-reject">
              <X data-icon="inline-start" />
              {a.reject}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
