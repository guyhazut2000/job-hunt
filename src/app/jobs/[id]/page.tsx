import { Suspense } from "react";
import { GapPlan } from "@/components/learning/GapPlan";
import Link from "next/link";
import type { AtsProvider } from "@prisma/client";
import { notFound } from "next/navigation";
import { ArrowRight, ExternalLink, MapPin } from "lucide-react";
import { auth } from "@/auth";
import { BackToTop } from "@/components/BackToTop";
import { CollapsibleText } from "@/components/CollapsibleText";
import { CvTips } from "@/components/CvTips";
import { LinkedinCompanyButton } from "@/components/LinkedinCompanyLink";
import { LinkedinJobButton, type LinkedinLink } from "@/components/LinkedinJobLink";
import { OutboundLink } from "@/components/OutboundLink";
import { MatchMeter } from "@/components/MatchMeter";
import { People } from "@/components/outreach/People";
import { SalarySection } from "@/components/salary/SalarySection";
import { SaveJobButton } from "@/components/SaveJobButton";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { linkedinStrings, type LinkedinStrings } from "@/lib/i18n/linkedin";
import { linkedinLinkFor, needsLinkedinCheck } from "@/lib/linkedin/jobs";
import { resolveLinkedinJob } from "@/lib/linkedin/resolve";
import { MatchReasons } from "@/components/profile/MatchReasons";
import { hasScorableProfile, scoreMatch, toCandidate } from "@/lib/profile/score";

export const dynamic = "force-dynamic";

function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Waits (streamed, inside Suspense) for the lazy LinkedIn lookup started by the page. */
async function LinkedinSlot(props: {
  pending: Promise<LinkedinLink>;
  jobId: string;
  s: LinkedinStrings;
  placement: "page" | "bar";
  className?: string;
}) {
  return <LinkedinJobButton link={await props.pending} {...props} />;
}

/** Brave lookups are paced; never hold the LinkedIn slot longer than this on a first view. */
const LINKEDIN_WAIT_MS = 4000;

const SOURCE_LABELS: Record<AtsProvider, string> = {
  GREENHOUSE: "Greenhouse",
  LEVER: "Lever",
  COMEET: "Comeet",
  ASHBY: "Ashby",
  WORKABLE: "Workable",
  SMARTRECRUITERS: "SmartRecruiters",
  WORKDAY: "Workday",
  RECRUITEE: "Recruitee",
  MANUAL: "",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const job = await db.job.findUnique({ where: { id: (await params).id }, include: { company: true } });
  return { title: job ? `${job.title} @ ${job.company.name}` : "Job" };
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ t, locale }, session, job] = await Promise.all([
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
  const match = hasScorableProfile(profile) ? scoreMatch(toCandidate(profile), job) : null;
  track("job_view", { jobId: id, source: job.source });

  // Lazy exact-posting lookup (Brave, cached on the Job, capped). One promise shared by both slots.
  const li = linkedinStrings(locale);
  const known = linkedinLinkFor(job);
  const pendingLinkedin: Promise<LinkedinLink> = needsLinkedinCheck(job)
    ? Promise.race([
        resolveLinkedinJob(job.id, "view")
          .then((r) => linkedinLinkFor({ ...job, linkedinUrl: r.url }))
          .catch(() => known),
        new Promise<LinkedinLink>((r) => setTimeout(() => r(known), LINKEDIN_WAIT_MS)),
      ])
    : Promise.resolve(known);
  const linkedinSlot = (placement: "page" | "bar", className?: string) => (
    <Suspense
      fallback={<LinkedinJobButton link={known} jobId={job.id} s={li} placement={placement} className={className} />}
    >
      <LinkedinSlot pending={pendingLinkedin} jobId={job.id} s={li} placement={placement} className={className} />
    </Suspense>
  );

  const applyButton = (placement: "page" | "bar") => (
    <Button asChild size="lg" className="w-full">
      <OutboundLink href={job.applyUrl} event="job_apply_click" kind="company" jobId={job.id} placement={placement}>
        {t.jobs.apply}
        <ExternalLink data-icon="inline-end" aria-hidden />
      </OutboundLink>
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
            {/* mobile: the action bar keeps only the primary apply button */}
            <div className="flex flex-col gap-2 pt-1 sm:max-w-sm lg:hidden">
              {linkedinSlot("page")}
              <LinkedinCompanyButton company={job.company} jobId={job.id} s={li} />
            </div>
          </header>

          <SalarySection job={job} company={job.company} profile={profile} loggedIn={!!userId} locale={locale} />

          {match && profile && userId && <GapPlan job={job} profile={profile} userId={userId} locale={locale} />}

          <section aria-labelledby="role-details" className="flex flex-col gap-3">
            <h2 id="role-details" className="kicker">
              {t.ui.roleDetails}
            </h2>
            <CollapsibleText
              moreLabel={t.ui.showMore}
              lessLabel={t.ui.showLess}
              className="text-foreground/90 max-w-[68ch] text-[1.02rem] leading-relaxed whitespace-pre-line"
            >
              <div dir="auto">{job.description}</div>
            </CollapsibleText>
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

          <div className="border-rule border-t-2 pt-6">
            <People company={job.company} job={job} userId={userId} t={t} />
          </div>
        </article>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <div className="bg-card hidden flex-col gap-2 rounded-lg border p-4 lg:flex">
            {applyButton("page")}
            {linkedinSlot("page")}
            <LinkedinCompanyButton company={job.company} jobId={job.id} s={li} />
            {userId && (
              <SaveJobButton jobId={job.id} saved={!!application} label={t.jobs.save} savedLabel={t.jobs.saved} />
            )}
          </div>

          {match ? (
            <section className="bg-card flex flex-col gap-4 rounded-lg border p-4" aria-label={t.jobs.match}>
              <div className="flex items-center gap-4">
                <MatchMeter score={match.score} label={t.jobs.match} size="lg" />
              </div>
              <MatchReasons t={t.match} reasons={match.reasons} />
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
            <p className="bg-card text-muted-foreground rounded-lg border p-4 text-sm">
              {userId ? (
                <Link href="/profile" className="text-foreground underline underline-offset-4">
                  {t.pv2.matchProfileHint}
                </Link>
              ) : (
                t.jobs.matchLoginHint
              )}
            </p>
          )}
          {userId && <CvTips jobId={job.id} label={t.jobs.generate} title={t.jobs.cvTips} />}
        </aside>
      </div>

      {/* mobile action bar — sits above the bottom nav */}
      <div className="bg-background/95 fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] z-30 flex gap-2 border-t px-4 py-3 backdrop-blur-md md:bottom-0 lg:hidden">
        <div className="flex-1">{applyButton("bar")}</div>
        {userId && (
          <SaveJobButton jobId={job.id} saved={!!application} label={t.jobs.save} savedLabel={t.jobs.saved} compact />
        )}
      </div>
      <div aria-hidden className="h-16 lg:hidden" />
      <BackToTop label={t.ui.backToTop} placement="action-bar" />
    </div>
  );
}
