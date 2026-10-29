import Link from "next/link";
import { ArrowLeft, Lightbulb } from "lucide-react";
import { SKILL_SUGGESTIONS } from "@/lib/concepts/catalog";
import { conceptSlug } from "@/lib/concepts/core";
import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/dictionaries";
import { conceptStrings } from "@/lib/i18n/concepts";
import { fmt } from "@/lib/i18n/learning";
import { SuggestionChips } from "./SuggestionChips";

/** Contextual concepts on a skill page (e.g. Docker → OSI, image layers, best practices). */
export async function SkillConceptsSection({
  skillId,
  skillLabel,
  userId,
  locale,
}: {
  skillId: string;
  skillLabel: string;
  userId?: string;
  locale: Locale;
}) {
  const names = SKILL_SUGGESTIONS[skillId];
  if (!names || names.length === 0) return null;
  const t = conceptStrings(locale);
  const slugs = names.map((n) => conceptSlug(n));
  const mine = userId
    ? await db.concept.findMany({ where: { userId, slug: { in: slugs } }, select: { id: true, slug: true } })
    : [];
  const idBySlug = new Map(mine.map((m) => [m.slug, m.id]));
  return (
    <section
      aria-labelledby="skill-concepts"
      data-testid="skill-concepts"
      className="bg-accent/35 flex flex-col gap-3 rounded-2xl border p-4"
    >
      <h2 id="skill-concepts" className="inline-flex items-center gap-2 text-xl font-bold">
        <Lightbulb className="text-primary size-5" aria-hidden />
        {fmt(t.skillSectionTitle, { skill: skillLabel })}
      </h2>
      <p className="text-foreground/75 max-w-[65ch] text-sm leading-relaxed">
        {fmt(t.skillSectionLead, { skill: skillLabel })}
      </p>
      <SuggestionChips
        signedIn={!!userId}
        items={names.map((name, i) => ({
          name,
          skill: skillId,
          source: `skill:${skillId}`,
          existingId: idBySlug.get(slugs[i]) ?? null,
        }))}
      />
      {userId && (
        <Link
          href="/learn/concepts"
          className="text-primary inline-flex min-h-10 w-fit items-center gap-1 text-sm font-semibold hover:underline"
        >
          {t.openAll}
          <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
        </Link>
      )}
    </section>
  );
}
