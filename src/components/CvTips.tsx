"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { getCvSuggestions } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { CvSuggestion } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

export function CvTips({
  jobId,
  label,
  title,
  id,
  className,
}: {
  jobId: string;
  label: string;
  title: string;
  /** Anchor for in-page jumps (e.g. the mobile action bar). */
  id?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const resultRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<{
    error?: string;
    notice?: string;
    cached?: boolean;
    provider?: string;
    suggestions?: CvSuggestion[];
  }>();
  // Bring fresh suggestions into view inside whichever scroller holds the panel (sticky sidebar or page).
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [result]);
  return (
    <section
      id={id}
      className={cn(
        "bg-card flex scroll-mt-[calc(var(--header-h)+1rem)] flex-col gap-3 rounded-lg border p-4",
        className,
      )}
      aria-busy={pending}
    >
      <h2 className="font-heading flex items-center gap-2 text-lg font-bold">
        <Sparkles className="text-primary size-4 shrink-0" aria-hidden />
        {title}
      </h2>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => start(async () => setResult(await getCvSuggestions(jobId)))}
      >
        <Sparkles data-icon="inline-start" aria-hidden />
        {pending ? "…" : label}
      </Button>
      <div aria-live="polite" ref={resultRef} className="scroll-mb-4">
        {pending && !result && (
          <div className="flex flex-col gap-2" data-testid="cv-tips-loading">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        )}
        {result?.error && <p className="text-destructive text-sm">{result.error}</p>}
        {result?.notice && <p className="text-muted-foreground pb-2 text-sm">{result.notice}</p>}
        {result?.suggestions && (
          <ol
            className={cn(
              "flex list-decimal flex-col gap-2 ps-5 text-sm leading-relaxed transition-opacity marker:font-mono",
              pending && "opacity-60",
            )}
          >
            {result.suggestions.map((s, i) => (
              <li key={i}>{s.text}</li>
            ))}
          </ol>
        )}
        {result?.provider && (
          <p className="text-muted-foreground pt-2 font-mono text-xs">
            provider: {result.provider}
            {result.cached ? " · cached" : ""}
          </p>
        )}
      </div>
    </section>
  );
}
