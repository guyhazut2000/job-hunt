"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { regenerateStage } from "@/app/learn/hub-actions";
import { Button } from "@/components/ui/button";
import type { LearningHubStrings } from "@/lib/i18n/learning-hub";

export function RegenerateButton({ skill, stage, t }: { skill: string; stage: string; t: LearningHubStrings }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-10"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await regenerateStage({ skill, stage });
            if (r.ok) router.refresh();
            else setMsg(t.regenErrors[r.error] ?? t.regenErrors.failed);
          })
        }
      >
        <RefreshCw className={pending ? "size-4 motion-safe:animate-spin" : "size-4"} aria-hidden />
        {pending ? t.regenerating : t.regenerate}
      </Button>
      <span role="status" aria-live="polite" className="text-caution text-xs empty:hidden">
        {msg}
      </span>
    </span>
  );
}
