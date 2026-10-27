"use client";

import type { ClickEvent, ClickKind, ClickPlacement } from "@/lib/events";

/** External link (new tab) that reports the click via sendBeacon without delaying navigation. */
export function OutboundLink({
  event,
  jobId,
  companyId,
  kind,
  placement,
  ...props
}: React.ComponentProps<"a"> & {
  event: ClickEvent;
  jobId?: string;
  companyId?: string;
  kind: ClickKind;
  placement: ClickPlacement;
}) {
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      {...props}
      onClick={(e) => {
        props.onClick?.(e);
        try {
          const body = JSON.stringify({ event, jobId, companyId, kind, placement });
          if (!navigator.sendBeacon?.("/api/events", body)) {
            void fetch("/api/events", { method: "POST", body, keepalive: true }).catch(() => {});
          }
        } catch {
          // analytics must never break the link
        }
      }}
    />
  );
}
