"use client";

import { useCallback, useState } from "react";
import { Bot, Hammer, MessagesSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LearningHubStrings } from "@/lib/i18n/learning-hub";
import type { StageContentData } from "@/lib/learning/content";
import type { PracticeState } from "@/lib/learning/progress";
import { WORKSPACE_TABS, type Stage, type WorkspaceTab } from "@/lib/learning/types";
import type { StoredFeedback } from "@/lib/learning/feedback";
import { PracticeList } from "./PracticeList";
import { QuestionDeck, type PriorRating } from "./QuestionDeck";
import { TutorChat, type TutorMessage } from "./TutorChat";

/** Practice / Q&A / AI tutor tabs for one stage. The active tab is mirrored to ?tab= (shareable, survives refresh). */
export function StageWorkspace({
  skill,
  stage,
  content,
  practice,
  priors,
  feedback,
  tutor,
  loggedIn,
  initialTab,
  t,
}: {
  skill: string;
  stage: Stage;
  content: StageContentData;
  practice: PracticeState;
  priors: Record<string, PriorRating>;
  feedback: Record<string, StoredFeedback>;
  tutor: { threadId: string | null; messages: TutorMessage[]; remaining: number | null; offline: boolean } | null;
  loggedIn: boolean;
  initialTab: WorkspaceTab;
  t: LearningHubStrings;
}) {
  const [tab, setTab] = useState<WorkspaceTab>(initialTab);
  const [draft, setDraft] = useState<string | null>(null);
  const clearDraft = useCallback(() => setDraft(null), []);

  const change = (v: string) => {
    const next = (WORKSPACE_TABS as readonly string[]).includes(v) ? (v as WorkspaceTab) : "practice";
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "practice") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(window.history.state, "", url);
  };

  const trigger = "min-h-11 flex-1 gap-1.5 px-2 text-[0.85rem] sm:px-4 sm:text-sm";
  return (
    <Tabs value={tab} onValueChange={change} className="gap-4">
      <TabsList className="bg-secondary sticky top-16 z-20 h-auto! w-full gap-1 rounded-xl p-1 shadow-sm sm:w-fit">
        <TabsTrigger value="practice" className={trigger}>
          <Hammer aria-hidden />
          {t.tabPractice}
        </TabsTrigger>
        <TabsTrigger value="qa" className={trigger}>
          <MessagesSquare aria-hidden />
          {t.tabQa}
        </TabsTrigger>
        <TabsTrigger value="tutor" className={trigger}>
          <Bot aria-hidden />
          {t.tabTutor}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="practice" className="outline-none">
        <PracticeList
          exercises={content.exercises}
          skill={skill}
          stage={stage}
          practice={practice}
          feedback={feedback}
          loggedIn={loggedIn}
          t={t}
          onAskTutor={(text) => {
            setDraft(text);
            change("tutor");
          }}
        />
      </TabsContent>
      <TabsContent value="qa" className="outline-none">
        <QuestionDeck
          questions={content.questions}
          skill={skill}
          stage={stage}
          priors={priors}
          feedback={feedback}
          loggedIn={loggedIn}
          t={t}
        />
      </TabsContent>
      <TabsContent value="tutor" forceMount hidden={tab !== "tutor"} className="outline-none">
        {tutor ? (
          <TutorChat
            skill={skill}
            stage={stage}
            initialThreadId={tutor.threadId}
            initialMessages={tutor.messages}
            initialRemaining={tutor.remaining}
            offline={tutor.offline}
            draft={draft}
            onDraftUsed={clearDraft}
            t={t}
          />
        ) : (
          <p className="text-muted-foreground bg-card rounded-xl border p-5 text-sm">{t.loginToPractice}</p>
        )}
      </TabsContent>
    </Tabs>
  );
}
