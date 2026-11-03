import { Sparkles } from "lucide-react";
import type { PersonalResult } from "@/lib/ranking/personal";
import { fillR, reasonText, type RankingStrings } from "@/lib/i18n/ranking";

/** "Why is this high?" — the personal score and its reasons, collapsible, above the card's link overlay. */
export function PersonalWhy({ result, s }: { result: PersonalResult; s: RankingStrings }) {
  return (
    <details className="group/why relative z-10 pt-1 text-sm" data-testid="personal-why">
      <summary className="text-primary inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 font-medium sm:min-h-0 [&::-webkit-details-marker]:hidden">
        <Sparkles className="size-3.5" aria-hidden />
        <span>
          {s.personalScore}{" "}
          <span className="font-mono" data-testid="personal-score">
            {result.score}
          </span>
        </span>
        <span aria-hidden className="text-border">
          ·
        </span>
        <span className="underline underline-offset-4">{fillR(s.why, { score: result.score })}</span>
      </summary>
      <div className="bg-muted/60 mt-2 rounded-md border p-3">
        <p className="mb-1.5 font-semibold">{s.whyTitle}</p>
        {result.reasons.length ? (
          <ul className="flex flex-col gap-1">
            {result.reasons.map((r, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3">
                <span dir="auto">{reasonText(r, s)}</span>
                {"points" in r && r.points > 0 && (
                  <span className="text-primary shrink-0 font-mono text-xs" dir="ltr">
                    {fillR(s.points, { n: r.points })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{s.noReasons}</p>
        )}
        <p className="text-muted-foreground mt-2 text-xs">{s.honest}</p>
      </div>
    </details>
  );
}
