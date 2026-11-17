"use client";

import { Check, EyeOff, Plus, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  addSuggestedSkill,
  loadAiSkillSuggestions,
  dismissSuggestedSkill,
  refreshSkillSuggestions,
  restoreDismissedSkills,
} from "@/app/profile/skill-suggest-actions";
import { ShowMoreList } from "@/components/density/ShowMoreList";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { DensityStrings } from "@/lib/i18n/density";
import { fillS, type SkillSuggestStrings } from "@/lib/i18n/skill-suggest";
import type { SkillSuggestion } from "@/lib/skill-suggest/core";
import type { SuggestResult } from "@/lib/skill-suggest/server";

const IMPACT_TONE: Record<SkillSuggestion["impact"], string> = {
  high: "bg-primary text-primary-foreground",
  medium: "bg-caution/15 text-foreground border-caution/40 border",
  low: "bg-muted text-muted-foreground",
};

export interface SkillSuggestionsData {
  analyzed: number;
  coverage: number;
  dismissed: number;
  source: "ai" | "rules";
  limited: string | null;
  computedAt: string;
  pendingAi?: boolean;
  suggestions: SkillSuggestion[];
}

export function SkillSuggestions({
  s,
  ds,
  data: initial,
  dateLocale,
}: {
  s: SkillSuggestStrings;
  ds: DensityStrings;
  data: SkillSuggestionsData;
  dateLocale: string;
}) {
  const [data, setData] = useState(initial);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const router = useRouter();
  const pending = busy !== null;
  // A server render (e.g. after saving the profile form) brings newer data.
  useEffect(() => {
    setData(initial);
    setHidden(new Set());
  }, [initial]);
  const list = data.suggestions.filter((x) => !hidden.has(x.key));
  const time = new Date(data.computedAt).toLocaleString(dateLocale, {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  /** Plain async calls (no transition): the busy flag always clears when the action returns. */
  const run = async (key: string, fn: () => Promise<SuggestResult>, after?: () => void) => {
    setBusy(key);
    try {
      const next = await fn();
      after?.();
      if (next.state === "ok") {
        setData(next);
        setHidden(new Set());
      } else router.refresh();
    } catch {
      setHidden(new Set());
      setNotice("");
    } finally {
      setBusy(null);
    }
  };

  // The page rendered a rules preview; fetch today's AI reading once.
  const wantsAi = !!data.pendingAi;
  useEffect(() => {
    if (wantsAi) void run("__refresh", loadAiSkillSuggestions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsAi]);

  return (
    <section
      aria-labelledby="skill-suggest-h"
      className="bg-card flex flex-col gap-4 rounded-lg border p-4 sm:p-5"
      data-testid="suggested-skills"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="skill-suggest-h" className="font-heading flex items-center gap-2 text-xl font-bold">
            <Sparkles className="text-primary size-5 shrink-0" aria-hidden />
            {s.title}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">{fillS(s.lead, { n: data.analyzed })}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={pending}
          onClick={() =>
            run(
              "__refresh",
              () => refreshSkillSuggestions(),
              () => setHidden(new Set()),
            )
          }
          data-testid="skill-suggest-refresh"
        >
          <RefreshCw className={`size-4 ${busy === "__refresh" ? "animate-spin" : ""}`} aria-hidden />
          {busy === "__refresh" ? s.refreshing : s.refresh}
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold">{fillS(s.coverage, { n: data.coverage })}</p>
        <Progress value={data.coverage} aria-label={fillS(s.coverage, { n: data.coverage })} className="h-2" />
        <p className="text-muted-foreground text-xs">
          {data.pendingAi && busy ? s.aiLoading : data.source === "ai" ? s.sourceAi : s.sourceRules} ·{" "}
          {fillS(s.updated, { time })}
        </p>
      </div>

      {data.limited && (
        <p className="border-caution/40 bg-caution/10 rounded-md border p-3 text-sm" role="status">
          {s.limited}
        </p>
      )}

      <p className="bg-muted rounded-md p-3 text-sm">
        {s.honest}{" "}
        <Link href="/learn/gaps" className="text-primary font-semibold underline underline-offset-4">
          {s.gapsLink}
        </Link>
      </p>

      <p className="sr-only" aria-live="polite">
        {notice}
      </p>

      {list.length === 0 ? (
        <p className="text-fit flex items-center gap-2 text-sm font-semibold" data-testid="skill-suggest-none">
          <Check className="size-4" aria-hidden />
          {s.none}
        </p>
      ) : (
        <ShowMoreList
          initial={5}
          step={5}
          s={ds}
          className="flex flex-col gap-3"
          testId="skill-suggest-list"
          label={s.title}
        >
          {list.map((x) => (
            <li
              key={x.key}
              className="flex flex-col gap-2 rounded-md border p-3 sm:p-4"
              data-testid="skill-suggestion"
              data-skill={x.label}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold" dir="ltr">
                  {x.label}
                </h3>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${IMPACT_TONE[x.impact]}`}>
                  {s.impact[x.impact]}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <p className="text-sm font-medium">
                  {fillS(s.askedBy, { jobs: x.jobs, total: data.analyzed, share: x.share })}
                </p>
                <ul className="flex flex-wrap gap-1.5 text-xs">
                  {x.required > 0 && (
                    <li className="border-primary/40 text-primary rounded-full border px-2 py-0.5 font-semibold">
                      {fillS(s.required, { n: x.required })}
                    </li>
                  )}
                  {x.preferred > 0 && (
                    <li className="text-muted-foreground rounded-full border px-2 py-0.5">
                      {fillS(s.preferred, { n: x.preferred })}
                    </li>
                  )}
                </ul>
              </div>
              <p className="text-muted-foreground text-xs">{fillS(s.gain, { gain: x.coverageGain })}</p>
              {x.inCv && <p className="text-fit text-xs font-semibold">{s.inCv}</p>}
              {x.examples.length > 0 && (
                <div className="text-muted-foreground flex min-w-0 flex-col gap-0.5 text-xs">
                  <span>{s.example}</span>
                  <ul className="flex min-w-0 flex-col gap-0.5">
                    {x.examples.map((e) => (
                      <li key={e.id} className="min-w-0 truncate">
                        <Link href={`/jobs/${e.id}`} className="hover:text-foreground underline underline-offset-2">
                          <bdi>{e.title}</bdi>
                          {e.company ? (
                            <>
                              {" · "}
                              <bdi>{e.company}</bdi>
                            </>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  className="min-h-11 flex-1 sm:flex-none"
                  disabled={pending}
                  data-testid="skill-suggest-add"
                  onClick={() =>
                    run(
                      x.key,
                      async () => (await addSuggestedSkill(x.label)).data,
                      () => {
                        setNotice(`${s.added}: ${x.label}`);
                        // The skills editor below re-reads the profile.
                        router.refresh();
                      },
                    )
                  }
                >
                  <Plus className="size-4" aria-hidden />
                  {busy === x.key ? s.adding : s.add}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11"
                  disabled={pending}
                  aria-label={fillS(s.dismissLabel, { skill: x.label })}
                  data-testid="skill-suggest-dismiss"
                  onClick={() => {
                    setHidden((h) => new Set(h).add(x.key));
                    run(`${x.key}:d`, () => dismissSuggestedSkill(x.key));
                  }}
                >
                  <EyeOff className="size-4" aria-hidden />
                  {s.dismiss}
                </Button>
              </div>
            </li>
          ))}
        </ShowMoreList>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {data.dismissed > 0 && (
          <>
            <span className="text-muted-foreground">{fillS(s.dismissed, { n: data.dismissed })}</span>
            <button
              type="button"
              className="text-primary min-h-11 font-semibold underline underline-offset-4"
              disabled={pending}
              onClick={() =>
                run(
                  "__restore",
                  () => restoreDismissedSkills(),
                  () => setHidden(new Set()),
                )
              }
            >
              {s.restore}
            </button>
          </>
        )}
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">{fillS(s.method, { n: data.analyzed })}</p>
    </section>
  );
}
