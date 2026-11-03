"use client";

import { useEffect, useRef, useState } from "react";
import { CopyButton } from "@/components/outreach/CopyButton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import { counterOfferDraft, type CounterInput } from "@/lib/offers/counter";
import type { SalaryHubStrings } from "@/lib/i18n/salary-hub";

export interface CounterPrefill {
  id: string;
  label: string;
  company: string;
  role: string;
  offered: number;
  ask: number;
}

/** Template-based counter-offer draft (#91). No AI, nothing is sent — the user copies it. */
export function CounterOfferDrafter({
  s,
  locale,
  name,
  prefills,
}: {
  s: SalaryHubStrings["negotiate"];
  locale: "he" | "en";
  name: string;
  prefills: CounterPrefill[];
}) {
  const [f, setF] = useState<CounterInput>({
    name,
    company: "",
    role: "",
    recruiter: "",
    offered: 0,
    ask: 0,
    reasons: "",
    extras: "",
    deadline: "",
  });
  const auto = counterOfferDraft(f, s.letter, locale);
  const [text, setText] = useState(auto);
  const [edited, setEdited] = useState(false);
  const reasonsRef = useRef<HTMLTextAreaElement>(null);
  const extrasRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!edited) setText(auto);
  }, [auto, edited]);

  const set = (patch: Partial<CounterInput>) => setF((x) => ({ ...x, ...patch }));
  const field = (k: "name" | "company" | "role" | "recruiter" | "deadline") => (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {s.c[k]}
      <Input
        value={f[k]}
        maxLength={120}
        dir="auto"
        onChange={(e) => set({ [k]: e.target.value })}
        data-testid={`counter-${k}`}
      />
    </label>
  );
  const money = (k: "offered" | "ask") => (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {s.c[k]}
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        dir="ltr"
        value={f[k] || ""}
        onChange={(e) => set({ [k]: Number(e.target.value) || 0 })}
        className="text-start"
        data-testid={`counter-${k}`}
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-4" data-testid="counter-drafter">
      {prefills.length > 0 && (
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {s.fromOffer}
          <select
            defaultValue=""
            onChange={(e) => {
              const p = prefills.find((x) => x.id === e.target.value);
              if (p) set({ company: p.company, role: p.role, offered: p.offered, ask: p.ask || f.ask });
            }}
            className="bg-background min-h-11 rounded-md border px-2"
            data-testid="counter-prefill"
          >
            <option value="">{s.fromOfferNone}</option>
            {prefills.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {field("name")}
        {field("recruiter")}
        {field("company")}
        {field("role")}
        {money("offered")}
        {money("ask")}
      </div>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {s.c.reasons}
        <span className="flex items-start gap-2">
          <Textarea
            ref={reasonsRef}
            value={f.reasons}
            rows={3}
            maxLength={1000}
            dir="auto"
            placeholder={s.c.reasonsPh}
            onChange={(e) => set({ reasons: e.target.value })}
            data-testid="counter-reasons"
          />
          <VoiceInputButton
            onText={(v) => set({ reasons: v })}
            getValue={() => reasonsRef.current?.value ?? ""}
            maxLength={1000}
            compact
            testId="counter-reasons-voice"
          />
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {s.c.extras}
        <span className="flex items-center gap-2">
          <Input
            ref={extrasRef}
            value={f.extras}
            maxLength={300}
            dir="auto"
            placeholder={s.c.extrasPh}
            onChange={(e) => set({ extras: e.target.value })}
          />
          <VoiceInputButton
            onText={(v) => set({ extras: v })}
            getValue={() => extrasRef.current?.value ?? ""}
            maxLength={300}
            compact
          />
        </span>
      </label>
      {field("deadline")}
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {s.c.draft}
        <Textarea
          value={text}
          rows={12}
          dir="auto"
          onChange={(e) => {
            setText(e.target.value);
            setEdited(true);
          }}
          className="leading-relaxed font-normal"
          data-testid="counter-draft"
        />
      </label>
      <div>
        <CopyButton text={text} label={s.c.copy} copiedLabel={s.c.copied} variant="default" />
      </div>
    </div>
  );
}
