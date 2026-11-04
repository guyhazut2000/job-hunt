import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ExternalLink, MessagesSquare, UsersRound } from "lucide-react";
import { DS_BY_ID } from "@/lib/algo/data-structures";
import { patternName } from "@/lib/algo/patterns";
import { getDictionary } from "@/lib/i18n";
import { prepStrings } from "@/lib/i18n/prep";
import { managerStrings } from "@/lib/i18n/manager";
import { localizedTitle } from "@/lib/i18n/titles";
import { STAGE_KINDS } from "@/lib/hiring/kinds";
import { labelFor, loadPrep } from "@/lib/prep/server";
import { requireUser } from "@/lib/session";
import { PrepEditor } from "@/components/prep/PrepEditor";
import { PrepSummaryCard } from "@/components/prep/PrepSummaryCard";
import { DebriefSection } from "@/components/prep/DebriefSection";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("prep");

/** Interview prep page per application (#93, docs/interview-prep.md). */
export default async function PrepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/prep/${id}`);
  const { locale, t: dict } = await getDictionary();
  const lang = locale === "en" ? "en" : "he";
  const s = prepStrings[locale];
  const view = await loadPrep(user.id, id, lang);
  if (!view) notFound();
  const { app } = view;
  const label = labelFor(lang);
  const topicName = (key: string) => {
    const [kind, itemId] = key.split(":");
    return kind === "ds" ? (DS_BY_ID.get(itemId)?.name ?? itemId) : patternName(itemId);
  };
  const topicHref = (key: string) => {
    const [kind, itemId] = key.split(":");
    return kind === "ds"
      ? `/learn/problem-solving/data-structures#${itemId}`
      : `/learn/problem-solving/patterns/${itemId}`;
  };
  const allTopics = [...new Set([...view.suggestedTopics, ...view.topics])].map((k) => ({
    key: k,
    name: topicName(k),
    href: topicHref(k),
    kind: k.startsWith("ds:") ? ("ds" as const) : ("pattern" as const),
  }));
  const storyOptions = view.stories.map((st) => ({
    id: st.id,
    label: st.kind === "ds" ? (DS_BY_ID.get(st.itemId)?.name ?? st.itemId) : patternName(st.itemId),
    preview: (st.situation || st.built).slice(0, 140),
  }));
  const simHref = `/interview?app=${app.id}`;
  const interviewAt = app.interviewAt
    ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "he-IL", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jerusalem",
      }).format(new Date(app.interviewAt))
    : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6" data-testid="prep">
      <header className="rule-double pb-4">
        <p className="kicker">{s.kicker}</p>
        <h1 className="text-title mt-1 font-black">
          <bdi>{app.title}</bdi> · <bdi>{app.company}</bdi>
        </h1>
        <p className="mt-2 text-sm">
          <Link href="/dashboard" className="text-primary underline-offset-4 hover:underline">
            {s.back}
          </Link>
        </p>
      </header>

      <section className="card flex flex-col gap-3" aria-labelledby="prep-overview" data-testid="prep-overview">
        <h2 id="prep-overview" className="font-heading text-lg font-bold">
          {s.overview}
        </h2>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{s.status}</dt>
            <dd className="font-semibold">{dict.status[app.status as keyof typeof dict.status] ?? app.status}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{s.interviewAt}</dt>
            <dd className="flex items-center gap-1 font-semibold">
              <CalendarClock className="size-4" aria-hidden />
              {interviewAt ?? <span className="text-muted-foreground font-normal">{s.noInterviewAt}</span>}
            </dd>
            {app.interviewNote && (
              <dd className="text-muted-foreground mt-1" dir="auto">
                {app.interviewNote}
              </dd>
            )}
          </div>
        </dl>
        {app.techStack.length > 0 && (
          <p className="flex flex-wrap gap-1.5" dir="ltr">
            {app.techStack.slice(0, 12).map((t) => (
              <span key={t} className="bg-muted rounded px-2 py-0.5 text-xs font-semibold">
                {t}
              </span>
            ))}
          </p>
        )}
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
          {app.url && (
            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              {s.posting}
            </a>
          )}
          {app.companySlug && (
            <Link href={`/companies/${app.companySlug}`} className="text-primary underline-offset-4 hover:underline">
              {s.companyPage}
            </Link>
          )}
        </p>
        <PrepSummaryCard s={s} applicationId={app.id} lang={lang} initial={view.summary} />
      </section>

      <PrepEditor
        s={s}
        locale={locale}
        applicationId={app.id}
        stagesSource={view.stagesSource}
        initial={{ stages: view.stages, storyIds: view.storyIds, topics: view.topics, questions: view.questions }}
        stageKinds={STAGE_KINDS.map((k) => ({ value: k, label: label(k) }))}
        topics={allTopics}
        suggestedTopics={view.suggestedTopics}
        stories={storyOptions}
        suggestedStoryIds={view.suggestedStoryIds}
      />

      <section className="card flex flex-col gap-2" aria-labelledby="prep-sim" data-testid="prep-sim">
        <h2 id="prep-sim" className="font-heading text-lg font-bold">
          {s.simTitle}
        </h2>
        <p className="text-muted-foreground text-sm">{s.simLead}</p>
        <Link
          href={simHref}
          className="bg-primary text-primary-foreground inline-flex min-h-10 w-fit items-center gap-2 rounded-md px-4 text-sm font-semibold"
          data-testid="prep-sim-link"
        >
          <MessagesSquare className="size-4" aria-hidden />
          {s.simCta}
        </Link>
        <Link
          href="/prep/manager"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-bold underline underline-offset-2"
          data-testid="prep-manager-link"
        >
          <UsersRound className="size-4" aria-hidden />
          {managerStrings(locale).title}
        </Link>
      </section>

      <DebriefSection
        s={s}
        locale={locale}
        applicationId={app.id}
        stageOptions={[
          ...new Map(
            [
              ...view.stages.map((st) => ({ value: st.kind, label: st.title })),
              ...STAGE_KINDS.map((k) => ({ value: k, label: label(k) })),
            ].map((o) => [o.value, o]),
          ).values(),
        ]}
        stageLabel={Object.fromEntries(STAGE_KINDS.map((k) => [k, label(k)]))}
        debriefs={view.debriefs}
      />
    </div>
  );
}
