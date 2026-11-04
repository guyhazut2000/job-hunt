import Link from "next/link";
import { fillD, type DensityStrings } from "@/lib/i18n/density";

/**
 * Server-rendered "מוצגים X מתוך Y · טען עוד" footer for `?show=N` paging (`@/lib/ui/paging`).
 * A plain link: works without JS, keeps the scroll position and the state lives in the URL.
 */
export function LoadMoreLink({
  href,
  shown,
  total,
  s,
  testId,
}: {
  /** Link to the next batch, or null when everything is shown. */
  href: string | null;
  shown: number;
  total: number;
  s: DensityStrings;
  testId?: string;
}) {
  if (total <= shown && !href) return null;
  return (
    <div className="flex flex-col items-center gap-3" data-testid={testId}>
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {fillD(s.showing, { shown, total })}
      </p>
      {href && (
        <Link
          href={href}
          scroll={false}
          prefetch={false}
          data-testid={testId ? `${testId}-next` : undefined}
          className="bg-card text-foreground hover:bg-muted inline-flex min-h-11 items-center rounded-full border px-6 text-sm font-semibold transition-colors"
        >
          {s.loadMore}
        </Link>
      )}
    </div>
  );
}
