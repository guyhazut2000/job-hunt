"use client";

import { useActionState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { generateDigestNow, type GenerateDigestState } from "@/app/digest-actions";
import { Button } from "@/components/ui/button";

export function GenerateDigest({
  label,
  labels,
}: {
  label: string;
  labels: { generating: string; ok: string; sent: string; failed: string; open: string };
}) {
  const [state, action, pending] = useActionState<GenerateDigestState>(generateDigestNow, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Button type="submit" size="sm" disabled={pending} data-testid="digest-generate">
        <RefreshCw data-icon="inline-start" aria-hidden className={pending ? "animate-spin" : undefined} />
        {pending ? labels.generating : label}
      </Button>
      <p role="status" aria-live="polite" className="text-sm font-semibold">
        {state?.ok ? (
          <span className="text-fit">
            {state.sent ? labels.sent : labels.ok}.{" "}
            {state.id && (
              <Link href={`/digest/${state.id}`} className="underline underline-offset-4">
                {labels.open}
              </Link>
            )}
          </span>
        ) : state?.error ? (
          <span className="text-destructive">{labels.failed}</span>
        ) : null}
      </p>
    </form>
  );
}
