"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { refreshCoachNow, type CoachRefreshState } from "@/app/coach-actions";
import { Button } from "@/components/ui/button";

export function RefreshCoach({ labels }: { labels: { label: string; pending: string; ok: string; failed: string } }) {
  const [state, action, pending] = useActionState<CoachRefreshState>(refreshCoachNow, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Button type="submit" size="sm" variant="outline" disabled={pending} data-testid="coach-refresh">
        <RefreshCw data-icon="inline-start" aria-hidden className={pending ? "animate-spin" : undefined} />
        {pending ? labels.pending : labels.label}
      </Button>
      <p role="status" aria-live="polite" className="text-sm font-semibold">
        {state?.ok ? (
          <span className="text-fit">{labels.ok}</span>
        ) : state?.error ? (
          <span className="text-destructive">{labels.failed}</span>
        ) : null}
      </p>
    </form>
  );
}
