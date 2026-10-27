"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { getCvSuggestions } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { CvSuggestion } from "@/lib/ai/types";

export function CvTips({ jobId, label, title }: { jobId: string; label: string; title: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ error?: string; provider?: string; suggestions?: CvSuggestion[] }>();
  return (
    <section className="bg-card flex flex-col gap-3 rounded-lg border p-4" aria-busy={pending}>
      <h2 className="font-heading text-lg font-bold">{title}</h2>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => start(async () => setResult(await getCvSuggestions(jobId)))}
      >
        <Sparkles data-icon="inline-start" aria-hidden />
        {pending ? "…" : label}
      </Button>
      <div aria-live="polite">
        {result?.error && <p className="text-destructive text-sm">{result.error}</p>}
        {result?.suggestions && (
          <ol className="flex list-decimal flex-col gap-2 ps-5 text-sm leading-relaxed marker:font-mono">
            {result.suggestions.map((s, i) => (
              <li key={i}>{s.text}</li>
            ))}
          </ol>
        )}
        {result?.provider && (
          <p className="text-muted-foreground pt-2 font-mono text-xs">provider: {result.provider}</p>
        )}
      </div>
    </section>
  );
}
