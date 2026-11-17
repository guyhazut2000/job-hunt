"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Bell, Check, Loader2, Pencil, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import {
  acceptBulletAction,
  deleteEntryAction,
  reanalyzeAction,
  saveAnswersAction,
  saveEntryAction,
  saveReminderAction,
  suggestBulletsAction,
} from "@/app/cv/journal/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { journalStrings } from "@/lib/i18n/journal";
import { fill } from "@/lib/i18n/notifications";
import type { JournalEntryView } from "@/lib/journal/server";

type Role = { key: string; label: string; current: boolean };
type Settings = { reminderOn: boolean; frequency: "daily" | "weekly"; weekday: number; hour: number };
type Period = "30" | "90" | "180" | "all" | "custom";
type BulletsRes = NonNullable<Awaited<ReturnType<typeof suggestBulletsAction>>>;

const SELECT = "bg-background h-10 w-full rounded-md border px-2 text-sm";
const CARD = "bg-card flex flex-col gap-3 rounded-xl border p-4";

function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function WorkJournal(props: {
  locale: "he" | "en";
  today: string;
  roles: Role[];
  defaultRole: string | null;
  entries: JournalEntryView[];
  jobs: { id: string; label: string }[];
  settings: Settings;
}) {
  const s = journalStrings(props.locale);
  const [entries, setEntries] = useState(props.entries);
  const [role, setRole] = useState(props.defaultRole ?? props.roles[0]?.key ?? "");
  const [day, setDay] = useState(props.today);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const roleLabel = (k: string) => props.roles.find((r) => r.key === k)?.label ?? "";

  const wroteThisWeek = entries.some((e) => e.day >= shiftDay(props.today, 6));

  function save() {
    setError(null);
    if (text.trim().length < 10) return setError(s.tooShort);
    start(async () => {
      const r = await saveEntryAction({ roleKey: role, day, text });
      if (!r.ok) return setError(s.tooShort);
      setEntries((xs) => [r.entry, ...xs].sort((a, b) => b.day.localeCompare(a.day)));
      setOpenId(r.entry.id);
      setText("");
    });
  }

  const replace = (e: JournalEntryView) => setEntries((xs) => xs.map((x) => (x.id === e.id ? e : x)));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        {!wroteThisWeek && (
          <p className="bg-primary/5 border-primary/30 rounded-md border px-3 py-2 text-sm" data-testid="journal-nudge">
            {fill(s.nudge, { when: s.nudgeWeek })}
          </p>
        )}

        <section className={CARD} data-testid="journal-form">
          {!props.roles.length && (
            <p className="text-muted-foreground text-sm">
              {s.noRoles}{" "}
              <Link href="/profile" className="text-primary font-semibold underline">
                {s.addRole}
              </Link>
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            {props.roles.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="journal-role">{s.role}</Label>
                <select
                  id="journal-role"
                  className={SELECT}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  data-testid="journal-role"
                >
                  {props.roles.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                      {r.current ? ` (${s.current})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="journal-day">{s.day}</Label>
              <input
                id="journal-day"
                type="date"
                className={SELECT}
                value={day}
                max={props.today}
                onChange={(e) => setDay(e.target.value || props.today)}
                data-testid="journal-day"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="journal-text">{s.text}</Label>
            <Textarea
              id="journal-text"
              rows={5}
              value={text}
              maxLength={4000}
              placeholder={s.placeholder}
              onChange={(e) => setText(e.target.value)}
              data-testid="journal-text"
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div>
            <Button onClick={save} disabled={saving} data-testid="journal-save">
              {saving ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <Check data-icon="inline-start" />
              )}
              {saving ? s.analyzing : s.save}
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-3" data-testid="journal-entries">
          <h2 className="font-heading text-lg font-bold">
            {s.entries} ({entries.length})
          </h2>
          {!entries.length && <p className="text-muted-foreground text-sm">{s.noEntries}</p>}
          {entries.map((e) => (
            <EntryCard
              key={e.id}
              e={e}
              s={s}
              roles={props.roles}
              today={props.today}
              open={openId === e.id}
              onToggle={() => setOpenId(openId === e.id ? null : e.id)}
              onChange={replace}
              onDelete={() => setEntries((xs) => xs.filter((x) => x.id !== e.id))}
              roleLabel={roleLabel(e.roleKey) || e.roleLabel}
            />
          ))}
        </section>
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <SuggestPanel s={s} roles={props.roles} defaultRole={role} jobs={props.jobs} today={props.today} />
        <ReminderPanel s={s} initial={props.settings} />
      </div>
    </div>
  );
}

type S = ReturnType<typeof journalStrings>;

function EntryCard(p: {
  e: JournalEntryView;
  s: S;
  roles: Role[];
  today: string;
  open: boolean;
  roleLabel: string;
  onToggle: () => void;
  onChange: (e: JournalEntryView) => void;
  onDelete: () => void;
}) {
  const { e, s } = p;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(e.text);
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(e.answers.map((a) => [a.q, a.a])),
  );
  const [busy, start] = useTransition();
  const ins = e.insights;

  const run = (fn: () => Promise<void>) => start(fn);
  return (
    <article className="bg-card flex flex-col gap-3 rounded-xl border p-4" data-testid="journal-entry">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="flex min-w-0 flex-col items-start text-start" onClick={p.onToggle}>
          <span className="text-sm font-semibold" dir="ltr">
            {e.day}
          </span>
          {p.roleLabel && <span className="text-muted-foreground truncate text-xs">{p.roleLabel}</span>}
        </button>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" aria-label={s.edit} onClick={() => setEditing((x) => !x)}>
            <Pencil />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={s.delete}
            disabled={busy}
            onClick={() => {
              if (!confirm(s.confirmDelete)) return;
              run(async () => {
                if (await deleteEntryAction(e.id)) p.onDelete();
              });
            }}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <Textarea rows={4} value={draft} maxLength={4000} onChange={(x) => setDraft(x.target.value)} />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || draft.trim().length < 10}
              onClick={() =>
                run(async () => {
                  const r = await saveEntryAction({ id: e.id, roleKey: e.roleKey, day: e.day, text: draft });
                  if (r.ok) {
                    p.onChange(r.entry);
                    setEditing(false);
                    setAnswers({});
                  }
                })
              }
            >
              {busy && <Loader2 className="animate-spin" data-icon="inline-start" />}
              {s.update}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              {s.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{e.text}</p>
      )}

      {p.open && ins && (
        <div
          className="bg-muted/40 flex flex-col gap-3 rounded-md border border-dashed p-3"
          data-testid="journal-insights"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles aria-hidden className="text-primary size-4" />
              {s.achievements}
            </p>
            <Badge variant="outline" data-testid="journal-source">
              {ins.source === "ai" ? s.sourceAi : ins.status === "limited" ? s.limited : s.sourceRules}
            </Badge>
          </div>
          <ul className="flex flex-col gap-2">
            {ins.achievements.map((a, i) => (
              <li key={i} className="flex flex-col gap-1 text-sm" data-testid="journal-achievement">
                <span>• {a.action}</span>
                {(a.tech.length > 0 || a.systems.length > 0) && (
                  <span className="flex flex-wrap gap-1">
                    {a.tech.map((t) => (
                      <Badge key={t} variant="secondary" dir="ltr">
                        {t}
                      </Badge>
                    ))}
                    {a.systems.map((t) => (
                      <Badge key={t} variant="outline">
                        {t}
                      </Badge>
                    ))}
                  </span>
                )}
                {a.impact && (
                  <span className="text-muted-foreground text-xs">
                    {s.impact}: {a.impact}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {ins.questions.length > 0 && (
            <div className="flex flex-col gap-2" data-testid="journal-questions">
              <p className="text-sm font-semibold">{s.questions}</p>
              {ins.questions.map((q, i) => (
                <div key={q} className="flex flex-col gap-1">
                  <Label htmlFor={`jq-${e.id}-${i}`} className="text-xs leading-relaxed">
                    {q}
                  </Label>
                  <input
                    id={`jq-${e.id}-${i}`}
                    className={SELECT}
                    placeholder={s.answer}
                    value={answers[q] ?? ""}
                    maxLength={500}
                    onChange={(x) => setAnswers((m) => ({ ...m, [q]: x.target.value }))}
                    data-testid="journal-answer"
                  />
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  data-testid="journal-save-answers"
                  onClick={() =>
                    run(async () => {
                      const r = await saveAnswersAction(
                        e.id,
                        Object.entries(answers).map(([q, a]) => ({ q, a })),
                      );
                      if (r) p.onChange(r);
                    })
                  }
                >
                  {busy && <Loader2 className="animate-spin" data-icon="inline-start" />}
                  {e.answers.length ? `${s.saveAnswers} ✓` : s.saveAnswers}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const r = await reanalyzeAction(e.id);
                      if (r) p.onChange(r);
                    })
                  }
                >
                  <RefreshCw data-icon="inline-start" />
                  {s.reanalyze}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      {!p.open && (ins?.achievements.length ?? 0) > 0 && (
        <button type="button" className="text-primary w-fit text-xs font-semibold underline" onClick={p.onToggle}>
          {s.achievements} ({ins?.achievements.length}){e.answers.length ? ` · ${s.answered} ${e.answers.length}` : ""}
        </button>
      )}
    </article>
  );
}

function SuggestPanel(p: {
  s: S;
  roles: Role[];
  defaultRole: string;
  jobs: { id: string; label: string }[];
  today: string;
}) {
  const { s } = p;
  const [role, setRole] = useState(p.defaultRole);
  const [period, setPeriod] = useState<Period>("90");
  const [from, setFrom] = useState(shiftDay(p.today, 30));
  const [to, setTo] = useState(p.today);
  const [jobId, setJobId] = useState("");
  const [res, setRes] = useState<BulletsRes | null>(null);
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<Record<number, string>>({});
  const [busy, start] = useTransition();

  const range = useMemo(() => {
    if (period === "all") return { from: null, to: null };
    if (period === "custom") return { from, to };
    return { from: shiftDay(p.today, Number(period)), to: null };
  }, [period, from, to, p.today]);

  if (!p.roles.length) return null;
  return (
    <section className={CARD} data-testid="journal-suggest">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-heading flex items-center gap-1.5 text-lg font-bold">
          <Sparkles aria-hidden className="text-primary size-4" />
          {s.suggestTitle}
        </h2>
        <p className="text-muted-foreground text-xs leading-relaxed">{s.suggestIntro}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="js-role">{s.role}</Label>
        <select id="js-role" className={SELECT} value={role} onChange={(e) => setRole(e.target.value)}>
          {p.roles.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="js-period">{s.period}</Label>
        <select
          id="js-period"
          className={SELECT}
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          data-testid="journal-period"
        >
          {(Object.keys(s.periods) as Period[]).map((k) => (
            <option key={k} value={k}>
              {s.periods[k]}
            </option>
          ))}
        </select>
      </div>
      {period === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="js-from" className="text-xs">
              {s.from}
            </Label>
            <input
              id="js-from"
              type="date"
              className={SELECT}
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="js-to" className="text-xs">
              {s.to}
            </Label>
            <input
              id="js-to"
              type="date"
              className={SELECT}
              value={to}
              max={p.today}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
      )}
      {p.jobs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="js-job">{s.job}</Label>
          <select id="js-job" className={SELECT} value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">{s.allJobs}</option>
            {p.jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <Button
          disabled={busy}
          data-testid="journal-suggest-run"
          onClick={() =>
            start(async () => {
              setEdits({});
              setStatus({});
              setRes(await suggestBulletsAction({ roleKey: role, ...range, jobId: jobId || null }));
            })
          }
        >
          {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
          {busy ? s.suggesting : s.suggest}
        </Button>
      </div>

      {res && (
        <div className="flex flex-col gap-3" data-testid="journal-bullets">
          <Badge variant="outline" className="w-fit" data-testid="journal-bullets-source">
            {res.source === "ai" ? s.sourceAi : res.status === "limited" ? s.limited : s.sourceRules}
          </Badge>
          {res.entries === 0 && <p className="text-muted-foreground text-sm">{s.noneInPeriod}</p>}
          {res.entries > 0 && !res.bullets.length && <p className="text-muted-foreground text-sm">{s.noneNew}</p>}
          {res.rejected > 0 && <p className="text-muted-foreground text-xs">{fill(s.rejected, { n: res.rejected })}</p>}
          {res.have.length > 0 && (
            <p className="text-xs">
              {s.have}: <span dir="ltr">{res.have.join(", ")}</span>
            </p>
          )}
          {res.missing.length > 0 && (
            <p className="text-muted-foreground text-xs">
              {s.missing}: <span dir="ltr">{res.missing.slice(0, 8).join(", ")}</span>
            </p>
          )}
          {res.bullets.map((b, i) =>
            status[i] === "rejected" ? null : (
              <div
                key={i}
                className="bg-muted/40 flex flex-col gap-2 rounded-md border p-3"
                data-testid="journal-bullet"
              >
                <Textarea
                  rows={3}
                  value={edits[i] ?? b.text}
                  maxLength={300}
                  disabled={status[i] === "added"}
                  onChange={(e) => setEdits((m) => ({ ...m, [i]: e.target.value }))}
                />
                {b.days.length > 0 && (
                  <p className="text-muted-foreground text-xs" dir="ltr">
                    {b.days.join(" · ")}
                  </p>
                )}
                {status[i] ? (
                  <p className="text-sm font-medium" data-testid="journal-bullet-status">
                    {status[i] === "added" ? s.added : status[i] === "exists" ? s.exists : s.noRole}{" "}
                    {status[i] === "added" && (
                      <Link href="/cv/standard" className="text-primary underline">
                        {s.openBuilder}
                      </Link>
                    )}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={busy}
                      data-testid="journal-bullet-accept"
                      onClick={() =>
                        start(async () => {
                          const r = await acceptBulletAction(role, edits[i] ?? b.text);
                          setStatus((m) => ({ ...m, [i]: r }));
                        })
                      }
                    >
                      <Check data-icon="inline-start" />
                      {edits[i] !== undefined && edits[i] !== b.text ? s.acceptEdited : s.accept}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setStatus((m) => ({ ...m, [i]: "rejected" }))}>
                      <X data-icon="inline-start" />
                      {s.reject}
                    </Button>
                  </div>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}

function ReminderPanel(p: { s: S; initial: Settings }) {
  const { s } = p;
  const [v, setV] = useState(p.initial);
  const [saved, setSaved] = useState(false);
  const [busy, start] = useTransition();
  const save = (next: Settings) => {
    setV(next);
    setSaved(false);
    start(async () => setSaved(await saveReminderAction(next)));
  };
  return (
    <section className={CARD} data-testid="journal-reminder">
      <h2 className="font-heading flex items-center gap-1.5 text-lg font-bold">
        <Bell aria-hidden className="text-primary size-4" />
        {s.reminderTitle}
      </h2>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4"
          checked={v.reminderOn}
          onChange={(e) => save({ ...v, reminderOn: e.target.checked })}
          data-testid="journal-reminder-on"
        />
        {s.reminderOn}
      </label>
      {v.reminderOn && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="jr-freq" className="text-xs">
              {s.frequency}
            </Label>
            <select
              id="jr-freq"
              className={SELECT}
              value={v.frequency}
              onChange={(e) => save({ ...v, frequency: e.target.value as Settings["frequency"] })}
            >
              <option value="weekly">{s.weekly}</option>
              <option value="daily">{s.daily}</option>
            </select>
          </div>
          {v.frequency === "weekly" && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="jr-day" className="text-xs">
                {s.weekday}
              </Label>
              <select
                id="jr-day"
                className={SELECT}
                value={v.weekday}
                onChange={(e) => save({ ...v, weekday: Number(e.target.value) })}
              >
                {s.days.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <Label htmlFor="jr-hour" className="text-xs">
              {s.hour}
            </Label>
            <select
              id="jr-hour"
              className={SELECT}
              value={v.hour}
              onChange={(e) => save({ ...v, hour: Number(e.target.value) })}
              dir="ltr"
            >
              {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => (
                <option key={h} value={h}>
                  {`${String(h).padStart(2, "0")}:00`}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <p className="text-muted-foreground text-xs leading-relaxed">{s.reminderNote}</p>
      {(busy || saved) && <p className="text-xs">{busy ? "…" : s.reminderSaved}</p>}
    </section>
  );
}
