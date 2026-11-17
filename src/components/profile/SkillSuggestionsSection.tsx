import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { densityStrings } from "@/lib/i18n/density";
import { skillSuggestStrings, type SkillSuggestStrings } from "@/lib/i18n/skill-suggest";
import { loadSkillSuggestions } from "@/lib/skill-suggest/server";
import { SkillSuggestions } from "./SkillSuggestions";

function Shell({ s, children }: { s: SkillSuggestStrings; children: React.ReactNode }) {
  return (
    <section
      aria-labelledby="skill-suggest-h"
      className="bg-card flex flex-col gap-3 rounded-lg border p-4 sm:p-5"
      id="suggested-skills"
      data-testid="suggested-skills"
    >
      <h2 id="skill-suggest-h" className="font-heading flex items-center gap-2 text-xl font-bold">
        <Sparkles className="text-primary size-5 shrink-0" aria-hidden />
        {s.title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Suggested skills from the user's best-matching jobs (docs/skill-suggestions.md). Renders from
 * today's cache or an instant rules preview (never waits on AI); the client then fetches the AI reading.
 */
export async function SkillSuggestionsSection({
  userId,
  locale,
  dateLocale,
}: {
  userId: string;
  locale: string;
  dateLocale: string;
}) {
  const s = skillSuggestStrings(locale);
  let r: Awaited<ReturnType<typeof loadSkillSuggestions>>;
  try {
    r = await loadSkillSuggestions(userId, { ai: false });
  } catch (e) {
    console.warn("[skill-suggest] failed:", e instanceof Error ? e.message.slice(0, 200) : "unknown");
    return (
      <Shell s={s}>
        <p className="text-muted-foreground text-sm">{s.error}</p>
      </Shell>
    );
  }
  if (r.state === "no-profile")
    return (
      <Shell s={s}>
        <p className="text-muted-foreground text-sm" data-testid="skill-suggest-empty">
          {s.noProfile}
        </p>
      </Shell>
    );
  if (r.state === "no-jobs")
    return (
      <Shell s={s}>
        <p className="text-muted-foreground text-sm" data-testid="skill-suggest-empty">
          {s.noJobs}
        </p>
        <Button asChild variant="outline" className="min-h-11 self-start">
          <Link href="/jobs">{s.noJobsCta}</Link>
        </Button>
      </Shell>
    );
  return <SkillSuggestions s={s} ds={densityStrings(locale)} data={r} dateLocale={dateLocale} />;
}
