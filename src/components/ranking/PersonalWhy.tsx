import { Sparkles } from "lucide-react";
import type { PersonalResult } from "@/lib/ranking/personal";
import { fillR, reasonText, type RankingStrings } from "@/lib/i18n/ranking";
import { cn } from "@/lib/utils";

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
                <bdi>{reasonText(r, s)}</bdi>
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
        {result.criteria.length > 0 && (
          <>
            <p className="mt-3 mb-1.5 font-semibold">{s.breakdown}</p>
            <ul className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2" data-testid="personal-breakdown">
              {[...result.criteria]
                .sort((a, b) => Number(b.on) - Number(a.on) || b.points - a.points)
                .map((c) => (
                  <li
                    key={c.key}
                    className={cn("flex items-baseline justify-between gap-3", !c.on && "text-muted-foreground")}
                    data-testid={`breakdown-${c.key}`}
                    data-state={!c.on ? "off" : c.value === null ? "nodata" : "scored"}
                  >
                    <span>{s.weightNames[c.key]}</span>
                    <span className="shrink-0 text-xs">
                      {!c.on ? (
                        s.off
                      ) : c.value === null ? (
                        <span className="text-muted-foreground">{s.noData}</span>
                      ) : (
                        <span className="font-mono" dir="ltr">
                          {c.value}% · {fillR(s.points, { n: c.points })}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
            </ul>
          </>
        )}
        <p className="text-muted-foreground mt-2 text-xs">{s.honest}</p>
      </div>
    </details>
  );
}
