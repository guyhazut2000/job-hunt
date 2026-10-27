"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { scanEmailNow } from "@/app/email-actions";
import { Button } from "@/components/ui/button";
import type { EmailSyncStrings } from "@/lib/i18n/email-sync";
import type { ScanSummary } from "@/lib/email/scan";

const KEYS = ["scanned", "created", "updated", "pending", "duplicates", "skipped"] as const;

export function ScanPanel({
  s,
  enabled,
  lastScanLabel,
  summary,
  error,
}: {
  s: EmailSyncStrings;
  enabled: boolean;
  lastScanLabel: string | null;
  summary: ScanSummary | null;
  error: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);
  const err = localError ?? error;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <p className="text-muted-foreground">{s.lastScan}</p>
          <p className="font-semibold">
            {lastScanLabel ? (
              <>
                {lastScanLabel} <span className="text-muted-foreground font-normal">({s.israelTime})</span>
              </>
            ) : (
              s.never
            )}
          </p>
        </div>
        <Button
          type="button"
          disabled={!enabled || pending}
          onClick={() =>
            start(async () => {
              const res = await scanEmailNow();
              setLocalError("error" in res ? res.error : null);
              router.refresh();
            })
          }
        >
          <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} aria-hidden />
          {pending ? s.scanning : s.scan}
        </Button>
      </div>
      {!enabled && <p className="text-muted-foreground text-sm">{s.connectFirst}</p>}
      {err && (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
        >
          {s.errors[err] ?? s.errors.scan_failed}
        </p>
      )}
      {summary && (
        <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-live="polite">
          {KEYS.map((k) => (
            <div key={k} className="bg-muted/60 rounded-md p-2 text-center">
              <dd
                className={`font-mono text-lg font-semibold ${k === "created" || k === "updated" ? "text-fit" : ""} ${k === "pending" ? "text-caution" : ""}`}
              >
                {summary[k] ?? 0}
              </dd>
              <dt className="text-muted-foreground text-xs">{s.summary[k]}</dt>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
