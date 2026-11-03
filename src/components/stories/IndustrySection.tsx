import { Factory } from "lucide-react";
import { auth } from "@/auth";
import { industryFor, type StoryItemKind } from "@/lib/algo/industry";
import { tr } from "@/lib/algo/types";
import type { Locale } from "@/lib/i18n/dictionaries";
import { storyStrings } from "@/lib/i18n/stories";
import { loginPath } from "@/lib/safe-next";
import type { StoryView } from "@/lib/stories/story";
import { WorkStoryCard } from "./WorkStoryCard";

/** Session user id for pages that render many sections (one auth() call). */
export async function sessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** "How it's used in industry" + the "My story" card for one data structure / pattern. */
export function IndustrySection({
  kind,
  itemId,
  name,
  locale,
  story,
  signedIn,
  returnTo,
}: {
  kind: StoryItemKind;
  itemId: string;
  name: string;
  locale: Locale;
  story: StoryView | null;
  signedIn: boolean;
  returnTo: string;
}) {
  const entry = industryFor(kind, itemId);
  if (!entry) return null;
  const s = storyStrings(locale);
  const lang = locale === "en" ? "en" : "he";
  return (
    <div className="flex flex-col gap-3" data-testid="industry-section">
      <div className="flex flex-col gap-1.5">
        <h3 className="kicker flex items-center gap-1.5">
          <Factory className="size-3.5" aria-hidden />
          {s.industryTitle}
        </h3>
        <ul className="flex flex-col gap-2 text-sm">
          {entry.uses.map((u) => (
            <li key={u.text.en} className="flex flex-col gap-1" data-testid="industry-use">
              <span className="leading-relaxed">{tr(u.text, locale)}</span>
              <span className="flex flex-wrap gap-1">
                {u.tools.map((tool) => (
                  <span key={tool} dir="ltr" className="bg-muted rounded px-1.5 py-0.5 font-mono text-[0.7rem]">
                    {tool}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <WorkStoryCard
        kind={kind}
        itemId={itemId}
        name={name}
        initial={story}
        example={entry.example[lang]}
        signedIn={signedIn}
        loginHref={loginPath(returnTo)}
        lang={lang}
        s={s}
      />
    </div>
  );
}
