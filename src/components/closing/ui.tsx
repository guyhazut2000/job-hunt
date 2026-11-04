import type { ReactNode } from "react";
import { ShieldCheck, Scale } from "lucide-react";
import { CopyButton } from "@/components/outreach/CopyButton";

export const selectCls =
  "border-input bg-background h-9 w-full min-w-0 rounded-md border px-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:outline-none";
export const fieldCls = "flex min-w-0 flex-col gap-1 text-sm";

/** "4 בנוב׳ 2026, 18:00" in Israel time. */
export function fmtWhen(d: Date | string | null | undefined, locale: "he" | "en", withTime = true): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString(locale === "he" ? "he-IL" : "en-GB", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

/** YYYY-MM-DD (a calendar day, no time zone) shown as a local date. */
export function fmtDay(s: string, locale: "he" | "en"): string {
  const d = new Date(`${s}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(locale === "he" ? "he-IL" : "en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function PageHeader({
  kicker,
  title,
  lead,
  noAuto,
  testId,
  children,
}: {
  kicker: string;
  title: string;
  lead: string;
  noAuto: string;
  testId: string;
  children?: ReactNode;
}) {
  return (
    <header className="rule-double pb-4">
      <p className="kicker">{kicker}</p>
      <h1 className="text-title mt-1 font-black">{title}</h1>
      <p className="text-muted-foreground mt-2">{lead}</p>
      <p
        className="mt-3 flex items-start gap-2 rounded-md border border-emerald-600/30 bg-emerald-600/5 p-3 text-sm"
        data-testid={testId}
      >
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden />
        <span>{noAuto}</span>
      </p>
      {children}
    </header>
  );
}

export function Disclaimer({ text }: { text: string }) {
  return (
    <p
      className="flex items-start gap-2 rounded-md border border-amber-600/30 bg-amber-500/5 p-3 text-sm"
      data-testid="closing-disclaimer"
    >
      <Scale className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
      <span>{text}</span>
    </p>
  );
}

/** A copy-only draft: read-only textarea + copy button. Never sends. */
export function DraftBox({
  title,
  text,
  copy,
  copied,
  testId,
}: {
  title: string;
  text: string;
  copy: string;
  copied: string;
  testId?: string;
}) {
  return (
    <details className="bg-muted/30 rounded-md border p-2" data-testid={testId}>
      <summary className="cursor-pointer text-sm font-medium">{title}</summary>
      <textarea
        readOnly
        dir="auto"
        value={text}
        rows={Math.min(14, text.split("\n").length + 1)}
        className="bg-background mt-2 w-full rounded-md border p-2 text-sm leading-relaxed"
      />
      <div className="mt-1">
        <CopyButton text={text} label={copy} copiedLabel={copied} />
      </div>
    </details>
  );
}
