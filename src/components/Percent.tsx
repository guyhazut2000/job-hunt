import { cn } from "@/lib/utils";

/**
 * A percentage that never wraps. The global `overflow-wrap: anywhere` lets a flex item
 * shrink to one glyph, which split "48%" into "4 / 8%" on narrow screens. This isolates the
 * number as LTR (correct "%" placement inside RTL text) and forbids any break inside it.
 */
export function Percent({
  value,
  className,
  signClassName,
  showSign = true,
}: {
  value: number;
  className?: string;
  signClassName?: string;
  showSign?: boolean;
}) {
  const v = Math.round(Math.max(0, Math.min(100, value)));
  return (
    <bdi
      dir="ltr"
      className={cn("inline-block shrink-0 [overflow-wrap:normal] whitespace-nowrap tabular-nums", className)}
    >
      {v}
      {showSign ? <span className={signClassName}>%</span> : null}
    </bdi>
  );
}
