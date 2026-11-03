import { TrendingUp } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Gap, Position, StepMove } from "@/lib/career/ladder";
import { fillS, type StepUpStrings } from "@/lib/i18n/step-up";
import { cn } from "@/lib/utils";

const TONE = {
  apply: "border-emerald-600/40 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
  stretch: "border-amber-600/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  far: "border-border bg-muted text-muted-foreground",
} as const;

/** The move (what kind of step) + gap analysis + "apply anyway?" guidance, collapsible, above the card overlay. */
export function StepUpGap({
  move,
  gap,
  position,
  jobRole,
  t,
  s,
}: {
  move: StepMove;
  gap: Gap;
  position: Position;
  /** The job's role category (the "to" of a broader-role move). */
  jobRole: string;
  t: Dictionary;
  s: StepUpStrings;
}) {
  const roleName = (r: string) => (t.roles as Record<string, string>)[r] ?? r;
  const moveText = fillS(s.moves[move.kind], {
    from: move.kind === "level" ? t.seniority[position.level] : roleName(position.role),
    to: move.kind === "level" ? t.seniority[move.level.level] : roleName(jobRole),
  });
  return (
    <details className="group/step relative z-10 pt-1 text-sm" data-testid="stepup-gap" data-verdict={gap.verdict}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-2 sm:min-h-0 [&::-webkit-details-marker]:hidden">
        <span
          className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", TONE[gap.verdict])}
          data-testid="stepup-verdict"
        >
          {s.verdicts[gap.verdict]}
        </span>
        <span className="text-primary inline-flex items-center gap-1 font-medium" data-testid="stepup-move">
          <TrendingUp className="size-3.5" aria-hidden />
          <span className="underline underline-offset-4">{moveText}</span>
        </span>
      </summary>
      <div className="bg-muted/60 mt-2 flex flex-col gap-1.5 rounded-md border p-3">
        <p className="font-semibold">{s.gapsTitle}</p>
        <ul className="flex list-disc flex-col gap-1 ps-5">
          <li dir="auto">
            {gap.missingSkills.length ? fillS(s.missingSkills, { list: gap.missingSkills.join(", ") }) : s.noMissing}
          </li>
          {move.level.years != null && <li>{gap.yearsGap > 0 ? fillS(s.yearsGap, { n: gap.yearsGap }) : s.yearsOk}</li>}
          {gap.leadershipGap && <li>{s.leadershipGap}</li>}
          {move.level.from === "requirements" && (
            <li className="text-muted-foreground">{fillS(s.levelFromReq, { years: move.level.years ?? "" })}</li>
          )}
        </ul>
        <p className="mt-1" data-testid="stepup-advice">
          {s.advice[gap.verdict]}
        </p>
        <p className="text-muted-foreground text-xs">{s.honest}</p>
      </div>
    </details>
  );
}
