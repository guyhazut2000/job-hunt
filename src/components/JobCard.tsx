import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import type { Company, Job } from "@prisma/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { formatAge } from "@/lib/format";
import { linkedinStrings } from "@/lib/i18n/linkedin";
import { linkedinLinkFor } from "@/lib/linkedin/jobs";
import { localeOf, salaryStrings } from "@/lib/i18n/salary";
import { estimateSalary } from "@/lib/salary/estimate";
import { SalaryChip } from "./salary/SalaryChip";
import { LinkedinJobInlineLink } from "./LinkedinJobLink";
import { MatchMeter } from "./MatchMeter";
import { TruncatedText } from "./TruncatedText";
import { cn } from "@/lib/utils";
import type { CommuteMode } from "@/lib/commute/keys";
import type { CommuteResult } from "@/lib/commute/types";
import { jobsMapStrings } from "@/lib/i18n/jobs-map";
import { CommuteChips } from "./map/CommuteChips";
import { DomainBadge } from "./DomainBadge";
import { fillRef, referralStrings } from "@/lib/i18n/referrals";

export function JobCard({
  job,
  t,
  score,
  highlight,
  commute,
  commuteMode,
  why,
  insider,
}: {
  job: Job & { company: Company };
  t: Dictionary;
  score?: number;
  /** Search terms to mark in the title and company name. */
  highlight?: string[];
  /** Travel times from the chosen origin (shown when a commute origin is set). */
  commute?: CommuteResult;
  commuteMode?: CommuteMode;
  /** Optional explanation under the card (e.g. the personal-ranking "why"), above the card link overlay. */
  why?: React.ReactNode;
  /** "יש לך מכר בפנים" (#92): the user knows someone at this company. */
  insider?: { count: number; contactId: string };
}) {
  const rs = insider ? referralStrings[localeOf(t)] : null;
  return (
    <article className="group hover:bg-muted/60 relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 px-4 py-5 transition-colors sm:px-5">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Link
            href={`/companies/${job.company.slug}`}
            className="text-foreground relative z-10 -my-2 inline-flex min-h-11 min-w-0 items-center font-bold hover:underline sm:min-h-0"
          >
            <TruncatedText text={job.company.name} highlight={highlight} />
          </Link>
          {job.company.nameHe && job.company.nameHe !== job.company.name && (
            <span dir="rtl" className="hidden min-w-0 truncate text-xs sm:inline" data-testid="company-name-he">
              {job.company.nameHe}
            </span>
          )}
          <span aria-hidden>·</span>
          <time dateTime={job.postedAt.toISOString()} className="shrink-0 font-mono text-xs">
            {formatAge(job.postedAt, t.dateLocale)}
          </time>
        </div>
        <h3 className="font-heading text-[1.15rem] leading-snug font-bold sm:text-xl">
          <Link
            href={`/jobs/${job.id}`}
            className="group-hover:text-primary decoration-primary/40 underline-offset-4 after:absolute after:inset-0 after:content-[''] hover:underline"
            dir="auto"
          >
            {/* above the card-wide ::after overlay so hovering the title can reveal the tooltip */}
            <TruncatedText text={job.title} lines={2} className="relative z-[1]" highlight={highlight} />
          </Link>
        </h3>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <DomainBadge domain={job.domain} locale={localeOf(t)} />
          {insider && rs && (
            <Link
              href={`/referrals?contact=${insider.contactId}&job=${job.id}#contact-${insider.contactId}`}
              className="relative z-10 inline-flex min-h-8 items-center gap-1 rounded-full border border-emerald-600/40 bg-emerald-600/10 px-2 text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-300"
              data-testid="job-card-insider"
            >
              <Users className="size-3.5" aria-hidden />
              {insider.count > 1 ? fillRef(rs.insiderBadgeN, { n: insider.count }) : rs.insiderBadge}
            </Link>
          )}
        </div>
        <p className="text-foreground/75 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {[
            <span key="l" className="inline-flex items-center gap-1">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {job.location}
            </span>,
            t.workMode[job.workMode],
            t.seniority[job.seniority],
          ].map((item, i) => (
            <span key={i} className="inline-flex items-center gap-2">
              {i > 0 && (
                <span aria-hidden className="text-border">
                  /
                </span>
              )}
              {item}
            </span>
          ))}
        </p>
        {commute && (
          <CommuteChips
            commute={commute}
            s={jobsMapStrings(localeOf(t))}
            active={commuteMode}
            size="sm"
            className="relative z-[1]"
          />
        )}
        <SalaryChip estimate={estimateSalary({ job, company: job.company })} s={salaryStrings(localeOf(t))} />
        {job.techStack.length > 0 && (
          <ul className="flex flex-wrap gap-1 pt-1" dir="ltr" aria-label={t.jobs.tech}>
            {job.techStack.slice(0, 6).map((s) => (
              <li
                key={s}
                className={cn("chip", highlight?.includes(s.toLowerCase()) && "border-primary/40 bg-primary/10")}
              >
                {s}
              </li>
            ))}
            {job.techStack.length > 6 && (
              <li dir="ltr" className="chip bg-transparent">
                +{job.techStack.length - 6}
              </li>
            )}
          </ul>
        )}
        <LinkedinJobInlineLink link={linkedinLinkFor(job)} jobId={job.id} s={linkedinStrings(localeOf(t))} />
        {why}
      </div>
      {score !== undefined && (
        <div className="self-start pt-1">
          <MatchMeter score={score} label={t.jobs.match} />
        </div>
      )}
    </article>
  );
}

export function JobList({ children }: { children: React.ReactNode }) {
  return <div data-job-list className="bg-card divide-border divide-y overflow-hidden rounded-lg border">{children}</div>;
}
