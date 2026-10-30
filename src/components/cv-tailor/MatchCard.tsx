import { CircleCheck, CircleDashed, Lightbulb } from "lucide-react";
import type { Suggestion } from "@/lib/cv-tailor/tailor";
import type { MatchSummary, Requirement } from "@/lib/cv-tailor/types";
import { type CvTailorStrings, requirementLabel } from "@/lib/i18n/cv-tailor";
import { fmt } from "@/lib/i18n/learning";

function evidence(t: CvTailorStrings, r: Requirement) {
  if (!r.evidence || r.kind !== "tech") return null;
  const where = r.evidence === "skills" ? t.evidenceSkills : r.evidence === "summary" ? t.evidenceSummary : r.evidence;
  return fmt(t.evidenceIn, { where });
}

export function MatchCard({ match, t }: { match: MatchSummary; t: CvTailorStrings }) {
  const total = match.covered.length + match.missing.length;
  return (
    <section
      aria-labelledby="cvt-match"
      className="bg-card flex flex-col gap-3 rounded-xl border p-4"
      data-testid="cvt-match"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="cvt-match" className="font-bold">
          {t.matchTitle}
        </h2>
        {total > 0 && <span className="text-fit font-mono text-lg font-black">{match.score}%</span>}
      </div>
      {total === 0 ? (
        <p className="text-muted-foreground text-sm">{t.matchNone}</p>
      ) : (
        <>
          <p className="text-muted-foreground text-xs">{fmt(t.matchScore, { n: match.score })}</p>
          <div className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden>
            <div className="bg-fit h-full" style={{ width: `${match.score}%` }} />
          </div>
          {match.covered.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h3 className="kicker">{t.covered}</h3>
              <ul className="flex flex-wrap gap-1.5" data-testid="cvt-covered">
                {match.covered.map((r) => (
                  <li
                    key={r.kind + r.label}
                    title={evidence(t, r) ?? undefined}
                    className="bg-fit-soft text-fit inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                  >
                    <CircleCheck className="size-3" aria-hidden />
                    <span dir="auto">{requirementLabel(t, r.kind, r.label)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {match.missing.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h3 className="kicker">{t.missing}</h3>
              <ul className="flex flex-wrap gap-1.5" data-testid="cvt-missing">
                {match.missing.map((r) => (
                  <li
                    key={r.kind + r.label}
                    className="bg-caution-soft text-caution inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                  >
                    <CircleDashed className="size-3" aria-hidden />
                    <span dir="auto">{requirementLabel(t, r.kind, r.label)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function suggestionText(t: CvTailorStrings, s: Suggestion): string {
  if (s.kind === "ai") return s.text ?? "";
  if (s.kind === "summary") return t.sugg.summary;
  return fmt(t.sugg[s.kind], { label: s.label });
}

export function SuggestionsCard({ suggestions, t }: { suggestions: Suggestion[]; t: CvTailorStrings }) {
  if (!suggestions.length) return null;
  return (
    <section
      aria-labelledby="cvt-sugg"
      className="bg-card flex flex-col gap-2 rounded-xl border p-4"
      data-testid="cvt-suggestions"
    >
      <h2 id="cvt-sugg" className="inline-flex items-center gap-1.5 font-bold">
        <Lightbulb className="text-primary size-4" aria-hidden />
        {t.suggestionsTitle}
      </h2>
      <p className="text-muted-foreground text-xs">{t.suggestionsNote}</p>
      <ul className="flex list-disc flex-col gap-1 ps-5 text-sm">
        {suggestions.map((s, i) => (
          <li key={i} dir="auto">
            {suggestionText(t, s)}
          </li>
        ))}
      </ul>
    </section>
  );
}
