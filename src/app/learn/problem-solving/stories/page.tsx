import Link from "next/link";
import { PageHead } from "@/components/problem-solving/PageHead";
import { StoryDeck, type DeckCard } from "@/components/stories/StoryDeck";
import { DS_BY_ID } from "@/lib/algo/data-structures";
import { PATTERN_BY_ID } from "@/lib/algo/patterns";
import type { PatternId } from "@/lib/algo/types";
import { getLocale } from "@/lib/i18n";
import { problemSolvingStrings } from "@/lib/i18n/problem-solving";
import { fill, storyStrings } from "@/lib/i18n/stories";
import { localizedTitle } from "@/lib/i18n/titles";
import { requireUser } from "@/lib/session";
import { listStories } from "@/lib/stories/server";
import { isEmptyStory, spokenName, templateAnswer } from "@/lib/stories/story";

export const generateMetadata = localizedTitle("psStories");

const BASE = "/learn/problem-solving";

export default async function StoriesPage() {
  const user = await requireUser(`${BASE}/stories`);
  const locale = await getLocale();
  const t = problemSolvingStrings(locale);
  const s = storyStrings(locale);
  const lang = locale === "en" ? "en" : "he";
  const rows = (await listStories(user.id)).filter((r) => !isEmptyStory(r.fields));
  const items = rows.map((r) => {
    const name =
      r.kind === "ds"
        ? (DS_BY_ID.get(r.itemId)?.name ?? r.itemId)
        : (PATTERN_BY_ID.get(r.itemId as PatternId)?.name ?? r.itemId);
    const href = r.kind === "ds" ? `${BASE}/data-structures#${r.itemId}` : `${BASE}/patterns/${r.itemId}#industry`;
    const answer = r.polished ?? templateAnswer(r.fields, name, lang);
    return { ...r, name, href, answer };
  });
  const cards: DeckCard[] = items.map((x) => ({
    key: `${x.kind}:${x.itemId}`,
    question: fill(s.storyQuestion, { name: spokenName(x.name) }),
    answer: x.answer,
  }));

  return (
    <div className="flex flex-col gap-8">
      <PageHead kicker={t.title} title={s.listTitle} lead={s.listLead}>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href={`${BASE}/data-structures`}
            className="bg-secondary hover:bg-muted rounded-full px-3 py-1.5 font-semibold"
          >
            {s.goDs}
          </Link>
          <Link
            href={`${BASE}/patterns`}
            className="bg-secondary hover:bg-muted rounded-full px-3 py-1.5 font-semibold"
          >
            {s.goPatterns}
          </Link>
        </div>
      </PageHead>

      {items.length === 0 ? (
        <p className="bg-card text-muted-foreground rounded-xl border p-5 text-sm" data-testid="stories-empty">
          {s.listEmpty}
        </p>
      ) : (
        <>
          <section className="bg-card flex flex-col gap-3 rounded-xl border p-4 sm:p-5">
            <h2 className="kicker">{s.practiceAll}</h2>
            <StoryDeck cards={cards} s={s} />
          </section>
          <ul className="grid gap-4 lg:grid-cols-2" data-testid="stories-list">
            {items.map((x) => (
              <li
                key={`${x.kind}:${x.itemId}`}
                className="bg-card flex min-w-0 flex-col gap-2 rounded-xl border p-4"
                data-testid="story-item"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 dir="ltr" className="text-start font-black rtl:text-end">
                    {x.name}
                  </h2>
                  <span className="text-muted-foreground text-xs">{x.kind === "ds" ? s.dsKind : s.patternKind}</span>
                </div>
                <p className="text-sm font-semibold">{fill(s.storyQuestion, { name: spokenName(x.name) })}</p>
                <p dir="auto" className="text-foreground/80 text-sm leading-relaxed">
                  {x.answer}
                </p>
                <p className="text-muted-foreground text-xs">{x.polishedSource === "ai" ? s.srcAi : s.srcTemplate}</p>
                <Link href={x.href} className="text-fit w-fit text-sm font-bold underline underline-offset-2">
                  {s.openItem}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
