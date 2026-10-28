"use client";

import { useEffect, useState } from "react";
import { Popover } from "radix-ui";
import { formatRelative, scanStatus, type ScanStatus, type ScanSummary } from "@/lib/ingestion/last-scan";
import type { LastScanStrings } from "@/lib/i18n/last-scan";
import { cn } from "@/lib/utils";

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

const DOT: Record<ScanStatus, string> = {
  ok: "bg-emerald-500",
  partial: "bg-amber-500",
  stale: "bg-red-500",
};

/**
 * "Last scan: 3 hours ago" chip with a status dot; tap/click opens the details (exact time, new
 * jobs, failures, next scheduled scan). The first render uses the server-computed strings, so
 * hydration matches; the relative time and status refresh client-side every minute afterwards.
 */
export function LastScanIndicator({
  scan,
  s,
  locale,
  initialRelative,
  initialStatus,
  exactTime,
  nextTime,
}: {
  scan: ScanSummary | null;
  s: LastScanStrings;
  locale: string;
  initialRelative: string;
  initialStatus: ScanStatus;
  exactTime: string;
  nextTime: string | null;
}) {
  const [relative, setRelative] = useState(initialRelative);
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    if (!scan) return;
    const tick = () => {
      setRelative(formatRelative(scan.finishedAt, locale));
      setStatus(scanStatus(scan));
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [scan, locale]);

  if (!scan) {
    return (
      <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs" data-testid="last-scan">
        <span className="size-2 rounded-full bg-red-500" aria-hidden />
        {s.never}
      </p>
    );
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-8 items-center gap-1.5 rounded-md text-xs focus-visible:ring-2 focus-visible:outline-none"
        title={fill(s.exact, { time: exactTime })}
        aria-label={`${s.label}: ${relative} · ${s.status[status]} · ${s.details}`}
        data-testid="last-scan"
        data-status={status}
        data-finished-at={scan.finishedAt}
      >
        <span className={cn("size-2 shrink-0 rounded-full", DOT[status])} aria-hidden />
        <span>
          {s.label}: <span className="text-foreground font-medium">{relative}</span>
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="bg-popover text-popover-foreground z-50 w-64 rounded-md border p-3 text-xs shadow-md"
          data-testid="last-scan-details"
        >
          <p className="flex items-center gap-1.5 font-semibold">
            <span className={cn("size-2 shrink-0 rounded-full", DOT[status])} aria-hidden />
            {s.status[status]}
          </p>
          <ul className="text-muted-foreground mt-2 space-y-1">
            <li>{fill(s.exact, { time: exactTime })}</li>
            <li>
              <span className="text-foreground font-mono">{fill(s.newJobs, { n: scan.created.toLocaleString() })}</span>
            </li>
            <li>
              {fill(s.companies, { n: scan.companies.toLocaleString() })}
              {scan.failed > 0 && <> · {fill(s.failed, { n: scan.failed })}</>}
            </li>
            {nextTime && <li>{fill(s.next, { time: nextTime })}</li>}
          </ul>
          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
