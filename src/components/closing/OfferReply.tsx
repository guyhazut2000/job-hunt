"use client";

import Link from "next/link";
import { ExternalLink, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { CopyButton } from "@/components/outreach/CopyButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { OfferReplyStrings } from "@/lib/i18n/offer-reply";
import type { OfferInput } from "@/lib/offers/calc";
import {
  ASK_KINDS,
  ASK_LABEL,
  MAX_ASKS,
  REPLY_SOURCES,
  offerReplyDraft,
  offerTermLines,
  type AskKind,
  type CounterAsk,
} from "@/lib/closing/reply";
import { cn } from "@/lib/utils";
import { fieldCls, selectCls } from "./ui";

/** Accept / counter email builder (#119) — live, copy-only, figures only from the saved offer. */
export function OfferReply({
  s,
  lang,
  company,
  role,
  myName,
  offer,
}: {
  s: OfferReplyStrings;
  lang: "he" | "en";
  company: string;
  role: string;
  myName: string | null;
  offer: Partial<OfferInput> | null;
}) {
  const [mode, setMode] = useState<"accept" | "counter">("accept");
  const [recruiter, setRecruiter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [asks, setAsks] = useState<CounterAsk[]>([{ kind: "base", target: "", why: "" }]);
  const draft = useMemo(
    () => offerReplyDraft({ mode, company, role, myName, recruiter, offer, startDate, asks }, lang),
    [mode, company, role, myName, recruiter, offer, startDate, asks, lang],
  );
  const hasTerms = offerTermLines(offer, lang).length > 0;
  const setAsk = (i: number, patch: Partial<CounterAsk>) => setAsks((a) => a.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const noAsks = !asks.some((a) => a.target.trim());

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label={s.title} className="flex flex-wrap gap-2">
        {(["accept", "counter"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-semibold",
              mode === m ? "bg-foreground text-background border-foreground" : "bg-card hover:bg-muted",
            )}
            data-testid={`reply-mode-${m}`}
          >
            {m === "accept" ? s.accept : s.counter}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={fieldCls}>
          <span>{s.recruiter}</span>
          <Input dir="auto" value={recruiter} maxLength={80} onChange={(e) => setRecruiter(e.target.value)} data-testid="reply-recruiter" />
        </label>
        <label className={fieldCls}>
          <span>{s.startDate}</span>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} data-testid="reply-start" />
        </label>
      </div>
      {mode === "counter" && (
        <fieldset className="flex flex-col gap-2" data-testid="reply-asks">
          <legend className="text-sm font-bold">{s.asks.replace("{n}", String(MAX_ASKS))}</legend>
          <p className="text-muted-foreground text-xs">{s.asksLead}</p>
          {asks.map((a, i) => (
            <div key={i} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <label className={fieldCls}>
                <span className="text-xs">{s.kind}</span>
                <select className={selectCls} value={a.kind} onChange={(e) => setAsk(i, { kind: e.target.value as AskKind })}>
                  {ASK_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {ASK_LABEL[k][lang]}
                    </option>
                  ))}
                </select>
              </label>
              <label className={fieldCls}>
                <span className="text-xs">{s.target}</span>
                <Input dir="auto" value={a.target} maxLength={200} placeholder={s.targetPh} onChange={(e) => setAsk(i, { target: e.target.value })} data-testid={`reply-target-${i}`} />
              </label>
              <label className={fieldCls}>
                <span className="text-xs">{s.why}</span>
                <Input dir="auto" value={a.why} maxLength={400} placeholder={s.whyPh} onChange={(e) => setAsk(i, { why: e.target.value })} />
              </label>
              <Button type="button" variant="ghost" size="sm" className="self-end" aria-label={s.remove} onClick={() => setAsks((x) => x.filter((_, j) => j !== i))}>
                <X aria-hidden />
              </Button>
            </div>
          ))}
          {asks.length < MAX_ASKS && (
            <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={() => setAsks((x) => [...x, { kind: "other", target: "", why: "" }])}>
              <Plus data-icon="inline-start" aria-hidden />
              {s.addAsk}
            </Button>
          )}
          {noAsks && <p className="text-muted-foreground text-xs">{s.noAsks}</p>}
        </fieldset>
      )}
      {!hasTerms && (
        <p className="text-sm">
          {s.noOffer}{" "}
          <Link href="/salary/offers" className="underline underline-offset-2">
            {s.toOffers}
          </Link>
        </p>
      )}
      <label className={fieldCls}>
        <span className="font-bold">{s.draft}</span>
        <Textarea readOnly dir="auto" rows={Math.min(22, draft.split("\n").length + 1)} value={draft} className="text-sm" data-testid="reply-draft" />
      </label>
      <div>
        <CopyButton text={draft} label={s.copy} copiedLabel={s.copied} />
      </div>
      <div className="text-xs">
        <p className="font-bold">{s.sources}</p>
        <ul className="mt-1 flex flex-col gap-1">
          {REPLY_SOURCES.map((src) => (
            <li key={src.url}>
              <a href={src.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                <bdi dir="auto">{src.label[lang]}</bdi>
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
