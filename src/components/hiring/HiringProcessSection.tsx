import Link from "next/link";
import { BadgeCheck, ExternalLink, GraduationCap, MessagesSquare } from "lucide-react";
import type { HiringStage } from "@prisma/client";
import type { Locale } from "@/lib/i18n/dictionaries";
import { hiringStrings, type HiringStrings } from "@/lib/i18n/hiring-process";
import { isStageKind, prepLinkFor, STAGE_KINDS, STAGE_LABELS } from "@/lib/hiring/kinds";
import { loadHiringProcess, type CheckedRef } from "@/lib/hiring/server";
import { communityLinks, type CommunityLink } from "@/lib/hiring/community";
import { cn } from "@/lib/utils";
import { MyProcessEditor } from "./MyProcessEditor";
import { ApplicationStageForm } from "./ApplicationStageForm";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const confidenceClass = (c: string) =>
  c === "high"
    ? "bg-fit/15 text-fit"
    : c === "medium"
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
      : "bg-muted text-muted-foreground";

function Timeline({
  stages,
  locale,
  s,
  techStack,
  currentStage,
  showSources,
}: {
  stages: HiringStage[];
  locale: Locale;
  s: HiringStrings;
  techStack: string[];
  currentStage?: string | null;
  showSources: boolean;
}) {
  return (
    <ol className="flex flex-col">
      {stages.map((st, i) => {
        const kind = isStageKind(st.kind) ? st.kind : "other";
        const label = STAGE_LABELS[locale][kind];
        const detail = locale === "he" ? (st.detailHe ?? st.detailEn) : (st.detailEn ?? st.detailHe);
        const prep = prepLinkFor(kind, techStack);
        const current = currentStage === kind;
        const showTitle = st.title && st.title.trim().toLowerCase() !== label.toLowerCase();
        return (
          <li key={st.id} className="relative flex min-w-0 gap-3 pb-5 last:pb-0">
            {i < stages.length - 1 && (
              <span aria-hidden className="bg-border absolute start-[0.9rem] top-8 bottom-0 w-px" />
            )}
            <span
              aria-hidden
              className={cn(
                "relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold",
                current ? "bg-primary text-primary-foreground border-primary" : "bg-card",
              )}
            >
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                <span className="font-bold">{label}</span>
                {showTitle && (
                  <bdi dir="auto" className="text-muted-foreground [overflow-wrap:anywhere]">
                    {st.title}
                  </bdi>
                )}
                {current && (
                  <span className="bg-primary/10 text-primary rounded-sm px-1.5 text-[0.68rem] font-semibold">
                    {s.current.badge}
                  </span>
                )}
              </p>
              {detail && (
                <p dir="auto" className="text-foreground/85 text-sm [overflow-wrap:anywhere]">
                  {detail}
                </p>
              )}
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                {st.duration && (
                  <span>
                    {s.duration}: <bdi dir="auto">{st.duration}</bdi>
                  </span>
                )}
                {prep && (
                  <Link
                    href={prep.href}
                    className="text-foreground/85 inline-flex min-h-8 items-center gap-1 font-semibold underline underline-offset-4"
                  >
                    <GraduationCap className="size-3.5 shrink-0" aria-hidden />
                    {s.prep}
                  </Link>
                )}
                {showSources && st.sourceUrl && (
                  <a
                    href={st.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground/85 inline-flex min-h-8 min-w-0 items-center gap-1 underline underline-offset-4"
                  >
                    {s.source}:{" "}
                    <bdi dir="ltr" className="truncate">
                      {hostOf(st.sourceUrl)}
                    </bdi>
                    <ExternalLink className="size-3 shrink-0" aria-hidden />
                  </a>
                )}
              </div>
              {showSources && st.evidence && (
                <details className="text-xs">
                  <summary className="text-muted-foreground inline-flex min-h-8 cursor-pointer items-center underline-offset-4 hover:underline">
                    {s.quote}
                  </summary>
                  <blockquote
                    dir="auto"
                    className="text-muted-foreground border-s-2 ps-3 [overflow-wrap:anywhere] italic"
                  >
                    “{st.evidence}”
                  </blockquote>
                </details>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function SourceList({ refs, s, showResult }: { refs: CheckedRef[]; s: HiringStrings; showResult: boolean }) {
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {refs.map((r) => (
        <li key={r.url} className="flex min-w-0 flex-wrap items-center gap-x-2">
          <a
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/85 inline-flex min-h-8 max-w-full min-w-0 items-center gap-1 underline underline-offset-4"
          >
            <bdi dir="auto" className="truncate">
              {r.title || hostOf(r.url)}
            </bdi>
            <ExternalLink className="size-3 shrink-0" aria-hidden />
          </a>
          {showResult && <span className="text-muted-foreground text-xs">· {s.checkedResult[r.result] ?? ""}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Outbound search links to community interview reports — never fetched (docs/hiring-process.md). */
function CommunityLinks({ links, s }: { links: CommunityLink[]; s: HiringStrings }) {
  if (!links.length) return null;
  return (
    <div data-testid="hiring-process-community" className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <MessagesSquare className="text-muted-foreground size-4 shrink-0" aria-hidden />
        <h3 className="text-sm font-bold">{s.community.title}</h3>
        <span className="rounded-sm bg-amber-500/15 px-1.5 text-[0.68rem] font-semibold text-amber-800 dark:text-amber-300">
          {s.community.badge}
        </span>
      </div>
      <p className="text-muted-foreground text-xs">{s.community.lead}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {links.map((l) => (
          <li key={l.id} className="min-w-0">
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-foreground/85 inline-flex min-h-8 items-center gap-1 underline underline-offset-4"
            >
              <span className="sr-only">{s.community.search}: </span>
              <bdi dir="ltr">{l.site}</bdi>
              {l.hebrew && <span className="text-muted-foreground text-xs">({s.community.hebrew})</span>}
              <ExternalLink className="size-3 shrink-0" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * "Hiring process" section for the company and job pages (docs/hiring-process.md). Self-contained:
 * loads its own data. Shows the official, source-grounded stages, or an explicit "no information"
 * state with the sources that were checked, plus the signed-in user's own process.
 */
export async function HiringProcessSection({
  companyId,
  companyName,
  jobId,
  techStack = [],
  userId,
  locale,
  application,
  className,
}: {
  companyId: string;
  companyName: string;
  jobId?: string;
  techStack?: string[];
  userId?: string | null;
  locale: Locale;
  application?: { id: string; currentStage: string | null } | null;
  className?: string;
}) {
  const s = hiringStrings(locale);
  const { official, mine } = await loadHiringProcess({ companyId, jobId, userId });
  const found = official?.status === "found" && official.stages.length > 0;
  const dateFmt = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", { dateStyle: "medium" });
  const kindOptions = STAGE_KINDS.map((k) => [k, STAGE_LABELS[locale][k]] as [string, string]);
  const currentStage = application?.currentStage ?? null;
  const community = communityLinks(companyName);

  return (
    <section
      aria-labelledby="hiring-process"
      data-testid="hiring-process"
      className={cn("border-rule flex min-w-0 flex-col gap-4 border-t-2 pt-6", className)}
    >
      <div className="flex flex-col gap-1">
        <h2 id="hiring-process" className="font-heading text-xl font-bold">
          {s.title}
        </h2>
        {found && (
          <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
            <span
              data-testid="hiring-process-official"
              className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-sm px-1.5 text-[0.68rem] font-semibold"
            >
              <BadgeCheck className="size-3 shrink-0" aria-hidden />
              {s.officialBadge}
            </span>
            <span>{official.scope === "job" ? s.leadJob : s.leadOfficial}</span>
            <span
              className={cn("rounded-sm px-1.5 text-[0.68rem] font-semibold", confidenceClass(official.confidence))}
            >
              {s.confidence[official.confidence as keyof HiringStrings["confidence"]] ?? official.confidence}
            </span>
          </p>
        )}
      </div>

      {found ? (
        <div className="bg-card flex min-w-0 flex-col gap-4 rounded-lg border p-4">
          <Timeline
            stages={official.stages}
            locale={locale}
            s={s}
            techStack={techStack}
            currentStage={currentStage}
            showSources
          />
          {official.estimatedDuration && (
            <p className="text-sm">
              <span className="font-semibold">{s.estimatedDuration}:</span>{" "}
              <bdi dir="auto">{official.estimatedDuration}</bdi>
            </p>
          )}
          {(locale === "he" ? official.notesHe : official.notesEn) && (
            <p dir="auto" className="text-muted-foreground text-sm">
              {locale === "he" ? official.notesHe : official.notesEn}
            </p>
          )}
          <div className="flex flex-col gap-1 border-t pt-3">
            <h3 className="text-sm font-bold">{s.sources}</h3>
            <SourceList
              refs={official.sourceRefs.map((r) => ({ ...r, result: "stages" as const }))}
              s={s}
              showResult={false}
            />
            <p className="text-muted-foreground text-xs">
              {s.checkedAt}: {dateFmt.format(official.checkedAt)} · {s.disclaimer}
            </p>
          </div>
          <div className="border-t pt-3">
            <CommunityLinks links={community} s={s} />
          </div>
        </div>
      ) : (
        <div
          data-testid="hiring-process-empty"
          className="bg-card flex min-w-0 flex-col gap-3 rounded-lg border border-dashed p-4"
        >
          <p className="font-semibold">{s.empty}</p>
          {official ? (
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-bold">{s.checkedSources}</h3>
              {official.checkedRefs.length ? (
                <SourceList refs={official.checkedRefs} s={s} showResult />
              ) : (
                <p className="text-muted-foreground text-sm">{s.noSourcesChecked}</p>
              )}
              <p className="text-muted-foreground text-xs">
                {s.checkedAt}: {dateFmt.format(official.checkedAt)} · {s.disclaimer}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{s.emptyNotChecked}</p>
          )}
          <div className="border-t pt-3">
            <CommunityLinks links={community} s={s} />
          </div>
        </div>
      )}

      {application && (
        <ApplicationStageForm
          applicationId={application.id}
          current={currentStage}
          options={kindOptions}
          s={s.current}
        />
      )}

      {mine && mine.stages.length > 0 && (
        <div className="bg-card flex min-w-0 flex-col gap-3 rounded-lg border p-4" data-testid="hiring-process-mine">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold">{s.mine.title}</h3>
            <span className="bg-primary/10 text-primary rounded-sm px-1.5 text-[0.68rem] font-semibold">
              {s.mine.badge}
            </span>
          </div>
          <Timeline
            stages={mine.stages}
            locale={locale}
            s={s}
            techStack={techStack}
            currentStage={currentStage}
            showSources={false}
          />
          {mine.estimatedDuration && (
            <p className="text-sm">
              <span className="font-semibold">{s.estimatedDuration}:</span>{" "}
              <bdi dir="auto">{mine.estimatedDuration}</bdi>
            </p>
          )}
        </div>
      )}

      <details className="bg-card rounded-lg border p-4">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-bold underline-offset-4 hover:underline">
          {mine ? s.mine.edit : s.mine.add}
        </summary>
        <p className="text-muted-foreground mb-3 text-sm">{s.mine.lead}</p>
        <MyProcessEditor
          companyId={companyId}
          companyName={companyName}
          jobId={jobId}
          loggedIn={!!userId}
          s={s.mine}
          options={kindOptions}
          initial={(mine?.stages ?? []).map((st) => ({
            kind: st.kind,
            title: st.title,
            note: (locale === "he" ? st.detailHe : st.detailEn) ?? "",
          }))}
          officialStages={found ? official.stages.map((st) => ({ kind: st.kind, title: "", note: "" })) : []}
          initialDuration={mine?.estimatedDuration ?? ""}
          hasMine={!!mine}
        />
      </details>
    </section>
  );
}
