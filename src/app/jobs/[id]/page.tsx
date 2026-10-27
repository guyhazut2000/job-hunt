import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ExternalLink, MapPin } from "lucide-react";
import { auth } from "@/auth";
import { CvTips } from "@/components/CvTips";
import { MatchMeter } from "@/components/MatchMeter";
import { SaveJobButton } from "@/components/SaveJobButton";
import { Button } from "@/components/ui/button";
import { computeMatch } from "@/lib/ai/match";
import { track } from "@/lib/analytics";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

const SOURCE_LABELS = { GREENHOUSE: "Greenhouse", LEVER: "Lever", COMEET: "Comeet", MANUAL: "" } as const;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const job = await db.job.findUnique({ where: { id: (await params).id }, include: { company: true } });
  return { title: job ? `${job.title} @ ${job.company.name}` : "Job" };
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ t }, session, job] = await Promise.all([
    getDictionary(),
    auth(),
    db.job.findUnique({ where: { id }, include: { company: true } }),
  ]);
  if (!job) notFound();
  const userId = session?.user?.id;
  const [profile, application] = userId
    ? await Promise.all([
        db.profile.findUnique({ where: { userId } }),
        db.application.findUnique({ where: { userId_jobId: { userId, jobId: id } } }),
      ])
    : [null, null];
  const match = profile && profile.skills.length ? computeMatch(profile, job) : null;
  track("job_view", { jobId: id, source: job.source });

  const applyButton = (
    <Button asChild size="lg" className="w-full">
      <a href={job.applyUrl} target="_blank" rel="noopener noreferrer">
        {t.jobs.apply}
        <ExternalLink data-icon="inline-end" aria-hidden />
      </a>
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/jobs"
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold"
      >
        <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
        {t.ui.allJobs}
      </Link>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article className="flex min-w-0 flex-col gap-6">
          <header className="rule-double flex flex-col gap-3 pb-6">
            <Link
              href={`/companies/${job.company.slug}`}
              className="kicker hover:text-foreground inline-flex min-h-11 w-fit items-center"
            >
              {job.company.name}
            </Link>
            <h1 className="text-title font-black">{job.title}</h1>
            <p className="text-foreground/80 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4" aria-hidden />
                {job.location}
              </span>
              <span>{t.workMode[job.workMode]}</span>
              <span>{t.seniority[job.seniority]}</span>
              <span>{t.roles[job.roleCategory]}</span>
              <span className="text-muted-foreground font-mono text-sm">
                {t.jobs.posted} {formatDate(job.postedAt, t.dateLocale, { year: "numeric" })}
              </span>
            </p>
            {job.techStack.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" dir="ltr" aria-label={t.jobs.tech}>
                {job.techStack.map((s) => (
                  <li key={s} className="chip">
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </header>

          <section aria-labelledby="role-details" className="flex flex-col gap-3">
            <h2 id="role-details" className="kicker">
              {t.ui.roleDetails}
            </h2>
            <div
              className="text-foreground/90 max-w-[68ch] text-[1.02rem] leading-relaxed whitespace-pre-line"
              dir="auto"
            >
              {job.description}
            </div>
          </section>

          {job.source !== "MANUAL" && (
            <p className="text-muted-foreground border-t pt-4 text-sm">
              {t.jobs.sourcedFrom.replace("{source}", SOURCE_LABELS[job.source])}{" "}
              <a
                href={job.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground inline-flex min-h-11 items-center underline underline-offset-4"
                dir="ltr"
              >
                {hostOf(job.applyUrl)}
              </a>
            </p>
          )}
        </article>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <div className="bg-card hidden flex-col gap-2 rounded-lg border p-4 lg:flex">
            {applyButton}
            {userId && (
              <SaveJobButton jobId={job.id} saved={!!application} label={t.jobs.save} savedLabel={t.jobs.saved} />
            )}
          </div>

          {match ? (
            <section className="bg-card flex flex-col gap-4 rounded-lg border p-4" aria-label={t.jobs.match}>
              <div className="flex items-center gap-4">
                <MatchMeter score={match.score} label={t.jobs.match} size="lg" />
              </div>
              {match.matchedSkills.length > 0 && (
                <div>
                  <h3 className="mb-1.5 text-sm font-bold">{t.jobs.matchedSkills}</h3>
                  <ul className="flex flex-wrap gap-1" dir="ltr">
                    {match.matchedSkills.map((s) => (
                      <li key={s} className="chip bg-fit-soft text-accent-foreground">
                        ✓ {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {match.missingSkills.length > 0 && (
                <div>
                  <h3 className="mb-1.5 text-sm font-bold">{t.jobs.missingSkills}</h3>
                  <ul className="flex flex-wrap gap-1" dir="ltr">
                    {match.missingSkills.map((s) => (
                      <li key={s} className="chip bg-caution-soft text-caution">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ) : (
            <p className="bg-card text-muted-foreground rounded-lg border p-4 text-sm">{t.jobs.matchLoginHint}</p>
          )}
          {userId && <CvTips jobId={job.id} label={t.jobs.generate} title={t.jobs.cvTips} />}
        </aside>
      </div>

      {/* mobile action bar — sits above the bottom nav */}
      <div className="bg-background/95 fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] z-30 flex gap-2 border-t px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="flex-1">{applyButton}</div>
        {userId && (
          <SaveJobButton jobId={job.id} saved={!!application} label={t.jobs.save} savedLabel={t.jobs.saved} compact />
        )}
      </div>
      <div aria-hidden className="h-16 lg:hidden" />
    </div>
  );
}
