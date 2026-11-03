"use client";

import { startTransition, useActionState, useId, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import type { ContactStatus } from "@prisma/client";
import { CheckCheck, ExternalLink, Sparkles, X } from "lucide-react";
import {
  draftFollowUp,
  draftOutreach,
  logOutreachSent,
  markFollowedUp,
  updateContactStatus,
  type LogSentState,
} from "@/app/outreach/actions";
import { Button } from "@/components/ui/button";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fillO, type OutreachAssistantStrings } from "@/lib/i18n/outreach-assistant";
import type { FollowUpMessage } from "@/lib/outreach/followup";
import {
  budgetLength,
  personalize,
  SHORT_LIMIT,
  type OutreachLang,
  type OutreachMessage,
} from "@/lib/outreach/messages";
import type { QueueItem, TrackerContact } from "@/lib/outreach/server";
import { cn } from "@/lib/utils";
import { CopyButton } from "../CopyButton";
import { STATUS_DOT, STATUSES } from "../ContactList";

function ExternalBadge({ s }: { s: OutreachAssistantStrings }) {
  return <span className="chip text-muted-foreground text-[11px]">{s.external}</span>;
}

function LangToggle({
  lang,
  setLang,
  s,
}: {
  lang: OutreachLang;
  setLang: (l: OutreachLang) => void;
  s: OutreachAssistantStrings;
}) {
  const uid = useId();
  return (
    <fieldset className="flex items-center gap-2" data-testid="outreach-lang">
      <legend className="sr-only">{s.lang}</legend>
      {(["he", "en"] as const).map((l) => (
        <label key={l} className="toggle-chip">
          <input
            type="radio"
            className="sr-only"
            name={`${uid}-lang`}
            value={l}
            checked={lang === l}
            onChange={() => setLang(l)}
          />
          <span lang={l}>{l === "he" ? "עברית" : "English"}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function OutreachAssistant({
  queue,
  contacts,
  canAi,
  locale,
  s,
  t,
}: {
  queue: QueueItem[];
  contacts: TrackerContact[];
  canAi: boolean;
  locale: OutreachLang;
  s: OutreachAssistantStrings;
  t: Dictionary["people"];
}) {
  const [lang, setLang] = useState<OutreachLang>(locale);
  const [skipped, setSkipped] = useState<string[]>([]);
  const visible = queue.filter((q) => !skipped.includes(q.key));
  const due = contacts.filter((c) => c.due);
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="queue-h" className="flex flex-col gap-3" data-testid="outreach-queue">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="queue-h" className="font-heading text-xl font-bold">
            {s.queueTitle}
          </h2>
          <LangToggle lang={lang} setLang={setLang} s={s} />
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">{fillO(s.queueLead, { n: visible.length })}</p>
        {visible.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm" data-testid="queue-empty">
            {s.queueEmpty}
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {visible.map((q, i) => (
              <li key={q.key}>
                <QueueCard
                  item={q}
                  index={i + 1}
                  lang={lang}
                  canAi={canAi}
                  s={s}
                  t={t}
                  onSkip={() => setSkipped((x) => [...x, q.key])}
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="follow-h" className="flex flex-col gap-3" data-testid="outreach-followups">
        <h2 id="follow-h" className="font-heading text-xl font-bold">
          {s.followTitle} {due.length > 0 && <span className="chip align-middle">{due.length}</span>}
        </h2>
        {due.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">{s.followEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {due.map((c) => (
              <li key={c.id}>
                <FollowUpCard c={c} lang={lang} canAi={canAi} s={s} t={t} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="tracker-h" className="flex flex-col gap-3" data-testid="outreach-tracker">
        <h2 id="tracker-h" className="font-heading text-xl font-bold">
          {s.trackerTitle}
        </h2>
        {contacts.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">{s.trackerEmpty}</p>
        ) : (
          <Tracker contacts={contacts} locale={locale} s={s} t={t} />
        )}
      </section>
    </div>
  );
}

function QueueCard({
  item,
  index,
  lang,
  canAi,
  s,
  t,
  onSkip,
}: {
  item: QueueItem;
  index: number;
  lang: OutreachLang;
  canAi: boolean;
  s: OutreachAssistantStrings;
  t: Dictionary["people"];
  onSkip: () => void;
}) {
  const uid = useId();
  const [name, setName] = useState("");
  const [ai, setAi] = useState<Partial<Record<OutreachLang, OutreachMessage>>>({});
  const [busy, startAi] = useTransition();
  const [state, action, pending] = useActionState<LogSentState, FormData>(logOutreachSent, undefined);
  const msg = ai[lang] ?? item.messages[lang];
  const note = personalize(msg.short, name);
  const len = name ? note.length : budgetLength(msg.short);
  return (
    <article className="bg-card flex flex-col gap-3 rounded-lg border p-4" data-testid="queue-card">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-semibold">
            {index}. {s.sources[item.source]}
          </p>
          <h3 className="font-heading text-lg font-bold break-words" dir="auto">
            {item.job ? (
              <Link href={`/jobs/${item.job.id}`} className="hover:text-primary underline-offset-4 hover:underline">
                {item.job.title}
              </Link>
            ) : null}
            <span className="text-muted-foreground font-normal"> · {item.company.name}</span>
          </h3>
          <p className="mt-1">
            <span className="chip">{t.categories[item.category]}</span>
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label={`${s.skip}: ${item.company.name}`} onClick={onSkip}>
          <X aria-hidden />
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm" className="min-h-11 sm:min-h-8">
          <a href={item.linkedin} target="_blank" rel="noopener noreferrer" data-testid="queue-open-linkedin">
            <ExternalLink data-icon="inline-start" aria-hidden />
            {s.openLinkedin}
          </a>
        </Button>
        <ExternalBadge s={s} />
      </div>

      <div>
        <div className="flex items-end justify-between gap-2">
          <label className="label" htmlFor={`${uid}-name`}>
            {s.recipient}
          </label>
          <VoiceInputButton targetId={`${uid}-name`} size="sm" testId="queue-name-voice" />
        </div>
        <input
          id={`${uid}-name`}
          className="input"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          placeholder={s.recipientHint}
          dir="auto"
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="label m-0">{s.note}</p>
          <span className="chip text-[11px]">{msg.source === "ai" ? s.aiBadge : s.templateBadge}</span>
        </div>
        <p
          className="bg-muted/50 rounded-md border p-3 text-sm leading-relaxed whitespace-pre-line"
          dir={lang === "he" ? "rtl" : "ltr"}
          lang={lang}
          data-testid="queue-note"
        >
          {note}
        </p>
        <p className={cn("text-xs", len > SHORT_LIMIT ? "text-destructive" : "text-muted-foreground")}>
          {len > SHORT_LIMIT ? s.tooLong : fillO(s.chars, { n: len })}
        </p>
        {msg.notice && <p className="text-muted-foreground text-xs">{msg.notice}</p>}
        <div className="flex flex-wrap gap-2">
          <CopyButton text={note} label={s.copy} copiedLabel={s.copied} />
          {canAi && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                startAi(async () => {
                  const r = await draftOutreach({
                    companyId: item.company.id,
                    jobId: item.job?.id ?? null,
                    category: item.category,
                    lang,
                  });
                  if (!("error" in r)) setAi((x) => ({ ...x, [lang]: r }));
                })
              }
            >
              <Sparkles data-icon="inline-start" aria-hidden />
              {busy ? s.aiBusy : s.ai}
            </Button>
          )}
        </div>
      </div>

      {state?.ok ? (
        <p className="text-fit text-sm font-semibold" aria-live="polite" data-testid="queue-sent-ok">
          {s.sentOk}
        </p>
      ) : (
        <form
          className="flex flex-col gap-2 border-t pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            data.set("name", name);
            startTransition(() => action(data));
          }}
        >
          <input type="hidden" name="companyId" value={item.company.id} />
          {item.job && <input type="hidden" name="jobId" value={item.job.id} />}
          <input type="hidden" name="category" value={item.category} />
          <label className="label" htmlFor={`${uid}-url`}>
            {s.profileUrl}
          </label>
          <input
            id={`${uid}-url`}
            name="linkedinUrl"
            type="url"
            inputMode="url"
            maxLength={400}
            placeholder="https://www.linkedin.com/in/…"
            className="input"
            dir="ltr"
            aria-invalid={state?.error === "linkedin" || undefined}
          />
          {state?.error === "linkedin" && <p className="text-destructive text-sm">{t.invalidLinkedin}</p>}
          {state?.error === "invalid" && <p className="text-destructive text-sm">{t.invalid}</p>}
          <Button type="submit" disabled={pending || !name.trim()} data-testid="queue-mark-sent">
            <CheckCheck data-icon="inline-start" aria-hidden />
            {pending ? "…" : s.markSent}
          </Button>
        </form>
      )}
    </article>
  );
}

function FollowUpCard({
  c,
  lang,
  canAi,
  s,
  t,
}: {
  c: TrackerContact;
  lang: OutreachLang;
  canAi: boolean;
  s: OutreachAssistantStrings;
  t: Dictionary["people"];
}) {
  const [ai, setAi] = useState<Partial<Record<OutreachLang, FollowUpMessage>>>({});
  const [busy, start] = useTransition();
  const [done, setDone] = useState(false);
  if (!c.due || done) return null;
  const msg = ai[lang] ?? c.due.drafts[lang];
  const text = personalize(msg.text, c.name.split(/\s+/)[0]);
  const open = c.linkedinUrl ?? c.searchUrl;
  return (
    <article className="bg-card flex flex-col gap-3 rounded-lg border p-4" data-testid="followup-card">
      <header>
        <p className="font-heading font-bold break-words" dir="auto">
          {c.name}
          {c.company && <span className="text-muted-foreground font-normal"> · {c.company.name}</span>}
        </p>
        <p className="text-muted-foreground text-sm">
          {fillO(s.followKind[c.due.kind], { days: c.due.days })} · {t.categories[c.category]}
        </p>
      </header>
      <p
        className="bg-muted/50 rounded-md border p-3 text-sm leading-relaxed whitespace-pre-line"
        dir={lang === "he" ? "rtl" : "ltr"}
        lang={lang}
        data-testid="followup-text"
      >
        {text}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={text} label={s.copy} copiedLabel={s.copied} />
        {open && (
          <Button asChild variant="outline" size="sm" className="min-h-11 sm:min-h-8">
            <a href={open} target="_blank" rel="noopener noreferrer">
              <ExternalLink data-icon="inline-start" aria-hidden />
              {s.openLinkedin}
            </a>
          </Button>
        )}
        {canAi && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() =>
              start(async () => {
                const r = await draftFollowUp({ contactId: c.id, lang });
                if (!("error" in r)) setAi((x) => ({ ...x, [lang]: r }));
              })
            }
          >
            <Sparkles data-icon="inline-start" aria-hidden />
            {busy ? s.aiBusy : s.ai}
          </Button>
        )}
        {!c.linkedinUrl && open && <ExternalBadge s={s} />}
      </div>
      <Button
        variant="secondary"
        data-testid="followup-done"
        onClick={() =>
          start(async () => {
            setDone(true);
            await markFollowedUp(c.id);
          })
        }
      >
        <CheckCheck data-icon="inline-start" aria-hidden />
        {s.markFollowed}
      </Button>
    </article>
  );
}

function Tracker({
  contacts,
  locale,
  s,
  t,
}: {
  contacts: TrackerContact[];
  locale: OutreachLang;
  s: OutreachAssistantStrings;
  t: Dictionary["people"];
}) {
  const [, start] = useTransition();
  const [items, apply] = useOptimistic(contacts, (state, u: { id: string; status: ContactStatus }) =>
    state.map((c) => (c.id === u.id ? { ...c, status: u.status } : c)),
  );
  const fmt = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jerusalem",
  });
  const date = (iso: string | null) => (iso ? fmt.format(new Date(iso)) : null);
  return (
    <ul className="bg-card divide-border flex flex-col divide-y rounded-lg border">
      {items.map((c) => (
        <li
          key={c.id}
          id={`contact-${c.id}`}
          className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center"
          data-testid="tracker-row"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[c.status])} />
              <span className="font-heading font-bold break-words" dir="auto">
                {c.name}
              </span>
              <span className="chip">{t.categories[c.category]}</span>
              {c.due && <span className="chip border-amber-500/40 bg-amber-500/10">{s.followTitle}</span>}
            </p>
            {(c.job || c.company) && (
              <p className="text-muted-foreground text-sm break-words" dir="auto">
                {c.job ? (
                  <Link href={`/jobs/${c.job.id}`} className="hover:text-primary underline-offset-4 hover:underline">
                    {c.job.title}
                  </Link>
                ) : null}
                {c.job && c.company ? " · " : ""}
                {c.company?.name}
              </p>
            )}
            <p className="text-muted-foreground text-xs" data-testid="tracker-dates">
              {[
                c.sentAt && fillO(s.sentOn, { date: date(c.sentAt)! }),
                c.statusAt && c.statusAt !== c.sentAt && fillO(s.statusOn, { date: date(c.statusAt)! }),
                c.followedUpAt && fillO(s.followedOn, { date: date(c.followedUpAt)! }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:w-56">
            {(c.linkedinUrl ?? c.searchUrl) && (
              <Button asChild variant="ghost" size="icon" aria-label={`${s.openLinkedin}: ${c.name}`}>
                <a href={(c.linkedinUrl ?? c.searchUrl)!} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden />
                </a>
              </Button>
            )}
            <select
              aria-label={`${t.status}: ${c.name}`}
              className="select-native min-h-11 flex-1 py-1 text-sm"
              value={c.status}
              data-testid="tracker-status"
              onChange={(e) => {
                const status = e.target.value as ContactStatus;
                start(async () => {
                  apply({ id: c.id, status });
                  await updateContactStatus(c.id, status);
                });
              }}
            >
              {STATUSES.map((st) => (
                <option key={st} value={st}>
                  {t.statuses[st]}
                </option>
              ))}
            </select>
          </div>
        </li>
      ))}
    </ul>
  );
}
