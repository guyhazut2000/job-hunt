"use client";

import { BellOff, Check, Clock, Copy, Mail, MailQuestion, RefreshCw, Send, Sparkles, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  getFollowUpDraft,
  markFollowUpSent,
  saveFollowUpDraft,
  setFollowUpOff,
  setNoResponse,
  snoozeFollowUp,
} from "@/app/followup-actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { gmailComposeLink, mailtoLink, type DraftLang, type DraftSource } from "@/lib/followup/draft";
import { SNOOZE_OPTIONS } from "@/lib/followup/timing";
import type { FollowUpView } from "@/lib/followup/view";
import type { FollowUpStrings } from "@/lib/i18n/followup";
import { cn } from "@/lib/utils";

const fill = (s: string, v: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => (k in v ? String(v[k]) : `{${k}}`));

export interface FollowUpTarget {
  id: string;
  title: string;
  company: string;
}

/** Card line + "open draft" button; renders nothing when there's nothing to say. */
export function FollowUpCardControl({
  app,
  view,
  s,
  autoOpen = false,
}: {
  app: FollowUpTarget;
  view: FollowUpView;
  s: FollowUpStrings;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  useEffect(() => {
    if (autoOpen && (view.kind === "due" || view.kind === "ghost")) setOpen(true);
  }, [autoOpen, view.kind]);
  const act = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });
  const sent = view.sent > 0 && view.lastSent ? fill(s.sentLine, { n: view.sent, date: view.lastSent }) : null;

  return (
    <div className="mt-1.5 flex flex-col gap-1" data-testid="followup-card" data-followup={view.kind}>
      {(view.kind === "due" || view.kind === "ghost") && (
        <>
          <span className="bg-caution-soft text-caution inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold">
            <MailQuestion className="size-3.5 shrink-0" aria-hidden />
            {view.kind === "ghost"
              ? s.ghostBadge
              : fill(view.round === 2 ? s.dueBadge2 : s.dueBadge, { days: view.days })}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-9 w-fit"
            onClick={() => setOpen(true)}
            data-testid="followup-open"
          >
            {view.kind === "ghost" ? <UserX aria-hidden /> : <Mail aria-hidden />}
            {view.kind === "ghost" ? s.markNoResponse : s.openDraft}
          </Button>
        </>
      )}
      {view.kind === "snoozed" && (
        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <Clock className="size-3.5" aria-hidden /> {fill(s.snoozedBadge, { date: view.until })}
        </span>
      )}
      {view.kind === "waiting" && view.sent > 0 && (
        <span className="text-muted-foreground text-xs">{fill(s.waitingLine, { date: view.dueOn })}</span>
      )}
      {view.kind === "replied" && <span className="text-fit text-xs font-semibold">{s.repliedLine}</span>}
      {view.kind === "off" && (
        <span className="text-muted-foreground inline-flex flex-wrap items-center gap-x-2 text-xs">
          <BellOff className="size-3.5" aria-hidden /> {s.offLine}
          <button
            type="button"
            disabled={pending}
            className="text-primary min-h-8 font-semibold underline-offset-4 hover:underline"
            onClick={() => act(() => setFollowUpOff(app.id, false))}
          >
            {s.remindAgain}
          </button>
        </span>
      )}
      {view.kind === "noResponse" && (
        <span className="inline-flex flex-wrap items-center gap-x-2 text-xs">
          <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-bold">{s.noResponseBadge}</span>
          <button
            type="button"
            disabled={pending}
            className="text-primary min-h-8 font-semibold underline-offset-4 hover:underline"
            onClick={() => act(() => setNoResponse(app.id, false))}
          >
            {s.unmarkNoResponse}
          </button>
        </span>
      )}
      {sent && <span className="text-muted-foreground text-xs">{sent}</span>}
      <FollowUpDialog app={app} view={view} s={s} open={open} onOpenChange={setOpen} />
    </div>
  );
}

/** Dashboard list row: title, badge and the same dialog. */
export function FollowUpRow({ app, view, s }: { app: FollowUpTarget; view: FollowUpView; s: FollowUpStrings }) {
  const [open, setOpen] = useState(false);
  if (view.kind !== "due" && view.kind !== "ghost") return null;
  return (
    <li
      className="bg-card flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-3"
      data-testid="followup-row"
    >
      <div className="min-w-0 flex-1">
        <p className="font-heading truncate font-bold" dir="auto">
          {app.title}
        </p>
        <p className="text-muted-foreground truncate text-sm" dir="auto">
          {app.company} ·{" "}
          <span className="text-caution font-semibold">
            {view.kind === "ghost"
              ? s.ghostBadge
              : fill(view.round === 2 ? s.dueBadge2 : s.dueBadge, { days: view.days })}
          </span>
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        className="min-h-10"
        onClick={() => setOpen(true)}
        data-testid="followup-row-open"
      >
        {view.kind === "ghost" ? <UserX aria-hidden /> : <Mail aria-hidden />}
        {view.kind === "ghost" ? s.markNoResponse : s.openDraft}
      </Button>
      <FollowUpDialog app={app} view={view} s={s} open={open} onOpenChange={setOpen} />
    </li>
  );
}

type Loaded = {
  lang: DraftLang;
  subject: string;
  body: string;
  to: string;
  source: DraftSource;
  toSource: "saved" | "email" | null;
  round: 1 | 2;
};

export function FollowUpDialog({
  app,
  view,
  s,
  open,
  onOpenChange,
}: {
  app: FollowUpTarget;
  view: FollowUpView;
  s: FollowUpStrings;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [d, setD] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const dirty = useRef(false);
  const ghost = view.kind === "ghost";

  async function load(lang?: DraftLang, regenerate = false) {
    setLoading(true);
    setError(false);
    try {
      const r = await getFollowUpDraft(app.id, lang, regenerate);
      if (!r.ok) {
        setError(r.error !== "max");
        return;
      }
      setD({
        lang: r.draft.lang,
        subject: r.draft.subject,
        body: r.draft.body,
        to: r.draft.to ?? "",
        source: r.draft.source,
        toSource: r.toSource,
        round: r.draft.round,
      });
      dirty.current = false;
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && !ghost && !d && !loading) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ghost]);

  const persist = async () => {
    if (!d || !dirty.current) return;
    dirty.current = false;
    await saveFollowUpDraft(app.id, { lang: d.lang, subject: d.subject, body: d.body, to: d.to }).catch(() => null);
  };
  const edit = (patch: Partial<Loaded>) => {
    dirty.current = true;
    setD((x) =>
      x ? { ...x, ...patch, ...(patch.subject != null || patch.body != null ? { source: "edited" } : {}) } : x,
    );
  };
  const close = (o: boolean) => {
    if (!o) void persist();
    onOpenChange(o);
  };
  const done = (fn: () => Promise<unknown>, msg?: string) =>
    start(async () => {
      try {
        await persist();
        await fn();
        if (msg) setNotice(msg);
        router.refresh();
        if (!msg) onOpenChange(false);
      } catch {
        setError(true);
      }
    });

  const srcLabel: Record<DraftSource, string> = {
    ai: s.srcAi,
    template: s.srcTemplate,
    limited: s.srcLimited,
    edited: s.srcEdited,
  };
  const link = d ? { to: d.to || null, subject: d.subject, body: d.body } : null;
  const fieldCls =
    "border-input bg-background focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-3";

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[92dvh] w-full rounded-t-xl sm:max-w-2xl"
        data-testid="followup-dialog"
      >
        <SheetHeader className="pe-12">
          <SheetTitle className="font-heading text-xl font-bold" dir="auto">
            {fill(s.dialogTitle, { title: app.title })}
          </SheetTitle>
          <SheetDescription dir="auto">
            {fill(s.dialogLead, { company: app.company, date: view.appliedOn })}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 px-4 pb-4">
          {ghost ? (
            <p className="text-sm">{fill(s.ghostLead, { days: view.kind === "ghost" ? view.days : 0 })}</p>
          ) : loading && !d ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
              <RefreshCw className="size-4 animate-spin" aria-hidden /> {s.loading}
            </p>
          ) : d ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground font-mono text-xs">{fill(s.round, { n: d.round })}</span>
                <div role="group" aria-label={s.language} className="flex gap-1">
                  {(["he", "en"] as const).map((l) => (
                    <Button
                      key={l}
                      type="button"
                      size="sm"
                      variant={d.lang === l ? "default" : "outline"}
                      aria-pressed={d.lang === l}
                      disabled={loading}
                      className="min-h-9"
                      onClick={() => {
                        if (d.lang === l) return;
                        void persist().then(() => load(l));
                      }}
                    >
                      {s[l]}
                    </Button>
                  ))}
                </div>
              </div>
              <label className="flex flex-col gap-1 text-sm font-semibold">
                {s.to}
                <input
                  type="email"
                  dir="ltr"
                  value={d.to}
                  placeholder={s.toPlaceholder}
                  onChange={(e) => edit({ to: e.target.value })}
                  onBlur={() => void persist()}
                  className={fieldCls}
                  data-testid="followup-to"
                />
                <span className="text-muted-foreground text-xs font-normal">
                  {d.toSource === "email" ? s.toFromEmail : !d.to ? s.toNone : ""}
                </span>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold">
                {s.subject}
                <input
                  dir="auto"
                  value={d.subject}
                  onChange={(e) => edit({ subject: e.target.value })}
                  onBlur={() => void persist()}
                  className={fieldCls}
                  data-testid="followup-subject"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold">
                {s.body}
                <textarea
                  dir="auto"
                  rows={9}
                  value={d.body}
                  onChange={(e) => edit({ body: e.target.value })}
                  onBlur={() => void persist()}
                  className={cn(fieldCls, "min-h-48 leading-relaxed")}
                  data-testid="followup-body"
                />
              </label>
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs" data-testid="followup-source">
                <Sparkles className="size-3.5 shrink-0" aria-hidden />
                {srcLabel[d.source]}
                <button
                  type="button"
                  className="text-primary ms-auto min-h-8 font-semibold underline-offset-4 hover:underline"
                  disabled={loading}
                  onClick={() => void load(d.lang, true)}
                >
                  {s.regenerate}
                </button>
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={async () => {
                    await navigator.clipboard.writeText(`${d.subject}\n\n${d.body}`).catch(() => null);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  data-testid="followup-copy"
                >
                  {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                  {copied ? s.copied : s.copy}
                </Button>
                <Button asChild variant="outline" className="min-h-11">
                  <a href={mailtoLink(link!)} onClick={() => void persist()} data-testid="followup-mailto">
                    <Mail aria-hidden /> {s.mailto}
                  </a>
                </Button>
                <Button asChild variant="outline" className="min-h-11">
                  <a
                    href={gmailComposeLink(link!)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => void persist()}
                    data-testid="followup-gmail"
                  >
                    <Send aria-hidden /> {s.gmail}
                  </a>
                </Button>
              </div>
              <Button
                type="button"
                className="min-h-11"
                disabled={pending || !!notice}
                onClick={() =>
                  done(
                    () => markFollowUpSent(app.id, { lang: d.lang, subject: d.subject, source: d.source }),
                    d.round >= 2 ? s.sentLast : fill(s.sentOk, { days: view.every }),
                  )
                }
                data-testid="followup-mark-sent"
              >
                <Check aria-hidden /> {s.markSent}
              </Button>
              <p className="text-muted-foreground text-center text-xs">{s.never}</p>
            </>
          ) : null}

          {notice && (
            <p role="status" className="text-fit text-sm font-semibold">
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {s.error}
            </p>
          )}

          <div className="border-border flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
            {ghost ? (
              <Button
                type="button"
                className="min-h-10"
                disabled={pending}
                onClick={() => done(() => setNoResponse(app.id, true))}
                data-testid="followup-no-response"
              >
                <UserX aria-hidden /> {s.markNoResponse}
              </Button>
            ) : (
              <>
                <span className="text-muted-foreground">{s.later}</span>
                {SNOOZE_OPTIONS.map((n) => (
                  <Button
                    key={n}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-9"
                    disabled={pending}
                    onClick={() => done(() => snoozeFollowUp(app.id, n))}
                    data-testid={`followup-snooze-${n}`}
                  >
                    <Clock aria-hidden /> {fill(s.laterDays, { n })}
                  </Button>
                ))}
              </>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-muted-foreground min-h-9 sm:ms-auto"
              disabled={pending}
              onClick={() => done(() => setFollowUpOff(app.id, true))}
              data-testid="followup-off"
            >
              <BellOff aria-hidden /> {s.dontRemind}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
