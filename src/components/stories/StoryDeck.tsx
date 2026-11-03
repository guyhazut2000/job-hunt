"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fill, type StoryStrings } from "@/lib/i18n/stories";
import { PracticeReveal } from "./WorkStoryCard";

export type DeckCard = { key: string; question: string; answer: string };

/** Flash-card practice over all saved stories: question first, answer on reveal. */
export function StoryDeck({ cards, s }: { cards: DeckCard[]; s: StoryStrings }) {
  const [i, setI] = useState(0);
  if (!cards.length) return null;
  const c = cards[i % cards.length];
  return (
    <div className="flex flex-col gap-2" data-testid="story-deck">
      <PracticeReveal key={c.key} question={c.question} answer={c.answer} s={s} />
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={cards.length < 2}
          onClick={() => setI((v) => (v - 1 + cards.length) % cards.length)}
        >
          <ChevronRight data-icon="inline-start" aria-hidden className="ltr:rotate-180" />
          {s.prev}
        </Button>
        <span className="text-muted-foreground text-xs" data-testid="story-deck-pos">
          {fill(s.card, { i: (i % cards.length) + 1, n: cards.length })}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={cards.length < 2}
          onClick={() => setI((v) => (v + 1) % cards.length)}
          data-testid="story-deck-next"
        >
          {s.next}
          <ChevronLeft data-icon="inline-end" aria-hidden className="ltr:rotate-180" />
        </Button>
      </div>
    </div>
  );
}
