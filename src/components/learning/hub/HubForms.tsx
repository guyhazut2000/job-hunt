"use client";

import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import { useState, useTransition, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { logStudySession, setWeeklyGoal } from "@/app/learn/hub-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LearningHubStrings } from "@/lib/i18n/learning-hub";

export function GoalEditor({ initial, t }: { initial: number; t: LearningHubStrings }) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(String(initial));
  const [pending, start] = useTransition();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await setWeeklyGoal({ hours: Number(hours) });
      if (r.ok) setOpen(false);
    });
  };
  if (!open)
    return (
      <Button type="button" variant="ghost" size="sm" className="min-h-10" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" aria-hidden />
        {t.goalSet}
      </Button>
    );
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="goal-hours" className="text-xs">
          {t.goalHours}
        </Label>
        <Input
          id="goal-hours"
          type="number"
          inputMode="numeric"
          min={1}
          max={60}
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          className="h-11 w-24"
          autoFocus
        />
      </div>
      <Button type="submit" className="min-h-11 rounded-full" disabled={pending}>
        {t.goalSave}
      </Button>
    </form>
  );
}

export function LogSessionForm({
  skills,
  defaultSkill,
  t,
}: {
  skills: { id: string; label: string }[];
  defaultSkill?: string;
  t: LearningHubStrings;
}) {
  const [skill, setSkill] = useState(defaultSkill ?? skills[0]?.id ?? "");
  const [minutes, setMinutes] = useState("30");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!skills.length) return null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await logStudySession({ skill, minutes: Number(minutes), note: note || undefined });
      if (r.ok) {
        setNote("");
        setMsg(t.logSaved);
      } else setMsg(r.error === "limit" ? t.logLimit : null);
    });
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor="log-skill" className="text-xs">
            {t.logSkill}
          </Label>
          <select
            id="log-skill"
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            className="border-input bg-background h-11 w-full min-w-0 rounded-md border px-2 text-sm"
          >
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="log-min" className="text-xs">
            {t.logMinutes}
          </Label>
          <Input
            id="log-min"
            type="number"
            inputMode="numeric"
            min={5}
            max={600}
            step={5}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="h-11"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-end justify-between gap-2">
          <Label htmlFor="log-note" className="text-xs">
            {t.logNote}
          </Label>
          <VoiceInputButton targetId="log-note" size="sm" testId="log-note-voice" />
        </div>
        <Textarea
          id="log-note"
          dir="auto"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" className="min-h-11 rounded-full" disabled={pending || !skill}>
          {t.logSave}
        </Button>
        <span role="status" aria-live="polite" className="text-fit text-sm font-semibold">
          {msg}
        </span>
      </div>
    </form>
  );
}
