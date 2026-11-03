"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateSummary } from "@/app/prep/actions";
import type { PrepStrings } from "@/lib/i18n/prep";
import type { PrepLang, PrepSummary } from "@/lib/prep/plan";

export function PrepSummaryCard({
  s,
  applicationId,
  lang,
  initial,
}: {
  s: PrepStrings;
  applicationId: string;
  lang: PrepLang;
  initial: PrepSummary | null;
}) {
  const [summary, setSummary] = useState(initial);
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      const r = await generateSummary(applicationId, lang);
      if ("summary" in r) setSummary(r.summary);
    });
  return (
    <div className="bg-muted/40 flex flex-col gap-2 rounded-md border p-3" data-testid="prep-summary">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-heading flex items-center gap-1 font-bold">
          <Sparkles className="size-4" aria-hidden />
          {s.summaryTitle}
        </h3>
        <span
          className="bg-caution-soft text-caution rounded px-2 py-0.5 text-xs font-bold"
          data-testid="prep-summary-unverified"
        >
          {s.unverified}
        </span>
      </div>
      {summary ? (
        <>
          {summary.source !== "ai" && (
            <p className="text-muted-foreground text-xs" data-testid="prep-summary-source">
              {summary.source === "limited" ? s.summaryLimited : s.summaryTemplate}
            </p>
          )}
          <p className="text-sm leading-relaxed" dir="auto">
            {summary.text}
          </p>
          {summary.focus.length > 0 && (
            <>
              <p className="text-sm font-semibold">{s.focus}</p>
              <ul className="list-disc ps-5 text-sm">
                {summary.focus.map((f) => (
                  <li key={f}>
                    <bdi>{f}</bdi>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : null}
      <p className="text-muted-foreground text-xs">{s.summaryHint}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={run}
        disabled={pending}
        data-testid="prep-summary-generate"
      >
        {pending ? s.saving : summary ? s.summaryRegen : s.summaryCta}
      </Button>
    </div>
  );
}
