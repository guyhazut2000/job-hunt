import { ExternalLink } from "lucide-react";
import type { Adjustment, SalaryEstimate } from "@/lib/salary/estimate";
import { SALARY_SOURCES } from "@/lib/salary/reference";
import type { SalaryStrings } from "@/lib/i18n/salary";
import type { Locale } from "@/lib/i18n/dictionaries";

const pct = (f: number) => String(Math.round(Math.abs(f - 1) * 100));

export function adjustmentText(a: Adjustment, s: SalaryStrings): string {
  switch (a.kind) {
    case "tier":
      return s.adjustments.tier[a.tier].replace("{pct}", pct(a.factor));
    case "intern":
      return s.adjustments.intern.replace("{pct}", String(Math.round(a.factor * 100)));
    case "executive":
      return s.adjustments.executive;
    case "marketReports":
      return s.adjustments.marketReports.replace("{n}", String(a.n));
    case "companyReports":
      return s.adjustments.companyReports.replace("{n}", String(a.n));
  }
}

/** Collapsible list of the data behind an estimate + disclaimer. */
export function SalarySources({ estimate, s, locale }: { estimate: SalaryEstimate; s: SalaryStrings; locale: Locale }) {
  return (
    <details className="group text-sm">
      <summary className="text-foreground/85 inline-flex min-h-11 cursor-pointer items-center font-semibold underline-offset-4 hover:underline">
        {s.sources}
      </summary>
      <ul className="text-muted-foreground mt-1 flex flex-col gap-1.5">
        {estimate.sourceIds.map((id) => {
          if (id === "posting") return <li key={id}>{s.sourcePosting}</li>;
          if (id === "reports") return <li key={id}>{s.sourceReports}</li>;
          const src = SALARY_SOURCES[id];
          if (!src) return null;
          return (
            <li key={id}>
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground/85 inline-flex items-center gap-1 underline underline-offset-4"
              >
                {locale === "he" ? src.nameHe : src.name}
                <ExternalLink className="size-3 shrink-0" aria-hidden />
              </a>
            </li>
          );
        })}
      </ul>
      <p className="text-muted-foreground mt-3 text-xs leading-relaxed">{s.disclaimer}</p>
    </details>
  );
}
