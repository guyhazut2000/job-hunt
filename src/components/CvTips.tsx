"use client";

import { useState, useTransition } from "react";
import { getCvSuggestions } from "@/app/actions";
import type { CvSuggestion } from "@/lib/ai/types";

export function CvTips({ jobId, label, title }: { jobId: string; label: string; title: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ error?: string; provider?: string; suggestions?: CvSuggestion[] }>();
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <button
          className="btn-primary"
          disabled={pending}
          onClick={() => start(async () => setResult(await getCvSuggestions(jobId)))}
        >
          {pending ? "…" : label}
        </button>
      </div>
      {result?.error && <p className="text-sm text-red-600">{result.error}</p>}
      {result?.suggestions && (
        <ul className="list-disc space-y-2 ps-5 text-sm text-slate-700">
          {result.suggestions.map((s, i) => (
            <li key={i}>{s.text}</li>
          ))}
        </ul>
      )}
      {result?.provider && <p className="text-xs text-slate-400">provider: {result.provider}</p>}
    </div>
  );
}
