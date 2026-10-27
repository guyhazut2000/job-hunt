import { formatIls, type SalaryBand } from "@/lib/salary/estimate";
import type { SalaryStrings } from "@/lib/i18n/salary";
import type { Locale } from "@/lib/i18n/dictionaries";

/**
 * Horizontal band: p25–p75 filled, median tick, optional suggested-ask bracket.
 * Rendered LTR (numbers grow left → right) in both locales, like any numeric axis.
 */
export function SalaryBandChart({
  band,
  ask,
  domain,
  s,
  locale,
  compact = false,
}: {
  band: SalaryBand;
  ask?: { low: number; high: number } | null;
  /** Shared scale (for comparing rows); defaults to the band ± 30%. */
  domain?: [number, number];
  s: SalaryStrings;
  locale: Locale;
  compact?: boolean;
}) {
  const [min, max] = domain ?? [band.p25 * 0.7, band.p75 * 1.3];
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100))}%`;
  const width = (a: number, b: number) =>
    `${Math.max(1, ((Math.min(b, max) - Math.max(a, min)) / (max - min)) * 100)}%`;
  const label = `${s.p25} ${formatIls(band.p25, locale)}, ${s.median} ${formatIls(band.median, locale)}, ${s.p75} ${formatIls(band.p75, locale)}`;

  return (
    <div dir="ltr" role="img" aria-label={label} className="w-full">
      <div className={compact ? "relative h-3" : "relative h-6"}>
        <div className="bg-muted absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full" />
        <div
          className="bg-primary/25 border-primary/50 absolute top-0 h-full rounded-sm border"
          style={{ left: pos(band.p25), width: width(band.p25, band.p75) }}
        />
        {ask && (
          <div
            className="border-fit absolute -top-1 -bottom-1 rounded-sm border-2 border-dashed"
            style={{ left: pos(ask.low), width: width(ask.low, ask.high) }}
          />
        )}
        <div
          className="bg-foreground absolute -top-1 -bottom-1 w-[3px] -translate-x-1/2 rounded-full"
          style={{ left: pos(band.median) }}
        />
      </div>
      {!compact && (
        <div className="text-muted-foreground relative mt-2 h-9 font-mono text-[0.72rem] tabular-nums">
          {(
            [
              [band.p25, s.p25, "-translate-x-full text-right"],
              [band.median, s.median, "-translate-x-1/2 text-center text-foreground font-semibold"],
              [band.p75, s.p75, "text-left"],
            ] as const
          ).map(([v, l, cls]) => (
            <span
              key={l}
              className={`absolute top-0 flex flex-col leading-tight whitespace-nowrap ${cls}`}
              style={{ left: pos(v) }}
            >
              <span>{formatIls(v, locale)}</span>
              <span className="font-sans text-[0.68rem]">{l}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
