"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import { deleteDebrief, saveDebrief } from "@/app/prep/actions";
import type { PrepStrings } from "@/lib/i18n/prep";

type Outcome = "pending" | "passed" | "failed";

export interface DebriefRow {
  id: string;
  stageKind: string;
  happenedAt: string;
  rating: number;
  asked: string;
  wentWell: string;
  improve: string;
  outcome: string;
}

const today = () => new Date().toISOString().slice(0, 10);

function VoiceArea({
  label,
  value,
  onChange,
  locale,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  locale: string;
  testId: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      <span className="flex items-center justify-between gap-2">
        {label}
        <VoiceInputButton
          locale={locale}
          onText={onChange}
          getValue={() => ref.current?.value ?? ""}
          maxLength={3000}
          compact
          testId={`${testId}-voice`}
        />
      </span>
      <Textarea
        ref={ref}
        value={value}
        maxLength={3000}
        rows={3}
        dir="auto"
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
      />
    </label>
  );
}

export function DebriefSection({
  s,
  locale,
  applicationId,
  stageOptions,
  stageLabel,
  debriefs,
}: {
  s: PrepStrings;
  locale: string;
  applicationId: string;
  stageOptions: Array<{ value: string; label: string }>;
  stageLabel: Record<string, string>;
  debriefs: DebriefRow[];
}) {
  const router = useRouter();
  const blank = {
    stageKind: stageOptions[0]?.value ?? "technical",
    happenedAt: today(),
    rating: 3,
    asked: "",
    wentWell: "",
    improve: "",
    outcome: "pending" as Outcome,
  };
  const [f, setF] = useState(blank);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<typeof f>) => {
    setMsg(null);
    setF((x) => ({ ...x, ...patch }));
  };
  const submit = () =>
    start(async () => {
      const r = await saveDebrief({ applicationId, ...f, happenedAt: new Date(f.happenedAt) });
      if ("ok" in r) {
        setF(blank);
        setMsg(s.debriefSaved);
        router.refresh();
      } else setMsg(s.saveError);
    });
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "he-IL", {
      dateStyle: "medium",
      timeZone: "Asia/Jerusalem",
    }).format(new Date(iso));

  return (
    <section className="card flex flex-col gap-3" aria-labelledby="prep-debrief" data-testid="prep-debrief">
      <div>
        <h2 id="prep-debrief" className="font-heading text-lg font-bold">
          {s.debriefTitle}
        </h2>
        <p className="text-muted-foreground text-sm">{s.debriefLead}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {s.debriefStage}
          <select
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            value={f.stageKind}
            onChange={(e) => set({ stageKind: e.target.value })}
            data-testid="debrief-stage"
          >
            {stageOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {s.debriefDate}
          <Input type="date" value={f.happenedAt} onChange={(e) => set({ happenedAt: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {s.debriefOutcome}
          <select
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            value={f.outcome}
            onChange={(e) => set({ outcome: e.target.value as Outcome })}
            data-testid="debrief-outcome"
          >
            {(["pending", "passed", "failed"] as const).map((o) => (
              <option key={o} value={o}>
                {s.outcomes[o]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="flex flex-col gap-1 text-sm font-semibold">
        <legend>{s.debriefRating}</legend>
        <div className="flex gap-2" role="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={f.rating === n}
              onClick={() => set({ rating: n })}
              className={`size-10 rounded-md border text-base font-bold ${f.rating === n ? "bg-primary text-primary-foreground" : "bg-background"}`}
              data-testid={`debrief-rating-${n}`}
            >
              {n}
            </button>
          ))}
        </div>
      </fieldset>
      <VoiceArea
        label={s.debriefAsked}
        value={f.asked}
        onChange={(v) => set({ asked: v })}
        locale={locale}
        testId="debrief-asked"
      />
      <VoiceArea
        label={s.debriefWell}
        value={f.wentWell}
        onChange={(v) => set({ wentWell: v })}
        locale={locale}
        testId="debrief-well"
      />
      <VoiceArea
        label={s.debriefImprove}
        value={f.improve}
        onChange={(v) => set({ improve: v })}
        locale={locale}
        testId="debrief-improve"
      />
      <div className="flex items-center gap-3">
        <Button type="button" onClick={submit} disabled={pending} data-testid="debrief-save">
          {pending ? s.saving : s.debriefSave}
        </Button>
        {msg && (
          <span className="text-sm font-semibold" role="status">
            {msg}
          </span>
        )}
      </div>

      {debriefs.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-heading font-bold">{s.debriefPast}</h3>
          <ul className="flex flex-col gap-2">
            {debriefs.map((d) => (
              <li key={d.id} className="rounded-md border p-3 text-sm" data-testid="debrief-row">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{stageLabel[d.stageKind] ?? d.stageKind}</span>
                  <span className="text-muted-foreground">{fmt(d.happenedAt)}</span>
                  <span className="bg-muted rounded px-1.5 text-xs font-bold">{d.rating}/5</span>
                  <span className="text-xs font-semibold">{s.outcomes[d.outcome as Outcome] ?? d.outcome}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ms-auto"
                    aria-label={s.debriefDelete}
                    onClick={() =>
                      start(async () => {
                        await deleteDebrief(d.id);
                        router.refresh();
                      })
                    }
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
                {d.asked && (
                  <p dir="auto">
                    <span className="text-muted-foreground">{s.debriefAsked}: </span>
                    {d.asked}
                  </p>
                )}
                {d.wentWell && (
                  <p dir="auto">
                    <span className="text-muted-foreground">{s.debriefWell}: </span>
                    {d.wentWell}
                  </p>
                )}
                {d.improve && (
                  <p dir="auto">
                    <span className="text-muted-foreground">{s.debriefImprove}: </span>
                    {d.improve}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
