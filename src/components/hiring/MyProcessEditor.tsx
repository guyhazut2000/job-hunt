"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { startTransition, useActionState, useId, useState } from "react";
import { saveMyHiringProcess, type MyProcessState } from "@/app/hiring-process/actions";
import { Button } from "@/components/ui/button";
import type { HiringStrings } from "@/lib/i18n/hiring-process";

interface Row {
  key: number;
  kind: string;
  title: string;
  note: string;
}
type RowInput = Omit<Row, "key">;

const MAX = 12;
let seq = 0;
const withKey = (r: RowInput): Row => ({ ...r, key: ++seq });

export function MyProcessEditor({
  companyId,
  companyName,
  jobId,
  loggedIn,
  s,
  options,
  initial,
  officialStages,
  initialDuration,
  hasMine,
}: {
  companyId: string;
  companyName: string;
  jobId?: string;
  loggedIn: boolean;
  s: HiringStrings["mine"];
  options: [string, string][];
  initial: RowInput[];
  officialStages: RowInput[];
  initialDuration: string;
  hasMine: boolean;
}) {
  const uid = useId();
  const [rows, setRows] = useState<Row[]>(() =>
    (initial.length ? initial : [{ kind: "phone_screen", title: "", note: "" }]).map(withKey),
  );
  const [state, action, pending] = useActionState<MyProcessState, FormData>(saveMyHiringProcess, undefined);

  if (!loggedIn)
    return (
      <p className="text-muted-foreground text-sm">
        {s.loginHint}{" "}
        <Link
          href="/login"
          className="text-foreground inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
        >
          {s.login}
        </Link>
      </p>
    );

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) =>
    setRows((rs) => {
      const j = i + d;
      if (j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const submit = (intent: "save" | "delete", form: HTMLFormElement) => {
    const data = new FormData(form);
    data.set("intent", intent);
    data.set("stages", JSON.stringify(rows.map(({ kind, title, note }) => ({ kind, title, note }))));
    startTransition(() => action(data));
  };
  const error = state && !state.ok ? state.error : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit("save", e.currentTarget);
      }}
      className="flex flex-col gap-4"
      aria-label={`${s.title} – ${companyName}`}
    >
      <input type="hidden" name="companyId" value={companyId} />
      {jobId && <input type="hidden" name="jobId" value={jobId} />}
      {officialStages.length > 0 && !hasMine && (
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-fit"
          onClick={() => setRows(officialStages.slice(0, MAX).map(withKey))}
        >
          {s.copyOfficial}
        </Button>
      )}
      <ol className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <li key={r.key} className="flex min-w-0 flex-col gap-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold">
                {s.stage} {i + 1}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={s.up}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={s.down}
                  disabled={i === rows.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={s.remove}
                  disabled={rows.length === 1}
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="min-w-0">
                <label className="label" htmlFor={`${uid}-kind-${i}`}>
                  {s.stageKind}
                </label>
                <select
                  id={`${uid}-kind-${i}`}
                  value={r.kind}
                  onChange={(e) => update(r.key, { kind: e.target.value })}
                  className="select-native"
                >
                  {options.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className="label" htmlFor={`${uid}-title-${i}`}>
                  {s.stageTitle}
                </label>
                <input
                  id={`${uid}-title-${i}`}
                  value={r.title}
                  maxLength={80}
                  dir="auto"
                  onChange={(e) => update(r.key, { title: e.target.value })}
                  className="input"
                />
              </div>
              <div className="min-w-0 sm:col-span-2">
                <label className="label" htmlFor={`${uid}-note-${i}`}>
                  {s.stageNote}
                </label>
                <input
                  id={`${uid}-note-${i}`}
                  value={r.note}
                  maxLength={300}
                  dir="auto"
                  onChange={(e) => update(r.key, { note: e.target.value })}
                  className="input"
                />
              </div>
            </div>
          </li>
        ))}
      </ol>
      {rows.length < MAX && (
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-fit"
          onClick={() => setRows((rs) => [...rs, withKey({ kind: "technical", title: "", note: "" })])}
        >
          <Plus className="size-4" aria-hidden />
          {s.addStage}
        </Button>
      )}
      <div className="min-w-0 sm:max-w-xs">
        <label className="label" htmlFor="hp-duration">
          {s.duration}
        </label>
        <input
          id="hp-duration"
          name="estimatedDuration"
          defaultValue={initialDuration}
          maxLength={60}
          dir="auto"
          placeholder={s.durationPlaceholder}
          className="input"
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="submit" disabled={pending} className="w-full sm:w-fit">
          {pending ? s.saving : s.save}
        </Button>
        {hasMine && (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            className="text-destructive w-full sm:w-fit"
            onClick={(e) => submit("delete", e.currentTarget.form!)}
          >
            {s.delete}
          </Button>
        )}
      </div>
      <p aria-live="polite" className={error ? "text-destructive text-sm" : "text-fit text-sm font-semibold"}>
        {error ? s.errors[error] : state?.ok ? (state.deleted ? s.deleted : s.saved) : null}
      </p>
    </form>
  );
}
