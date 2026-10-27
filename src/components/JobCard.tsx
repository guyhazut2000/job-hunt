import Link from "next/link";
import { MapPin } from "lucide-react";
import type { Company, Job } from "@prisma/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { formatAge } from "@/lib/format";
import { localeOf, salaryStrings } from "@/lib/i18n/salary";
import { estimateSalary } from "@/lib/salary/estimate";
import { SalaryChip } from "./salary/SalaryChip";
import { MatchMeter } from "./MatchMeter";

export function JobCard({ job, t, score }: { job: Job & { company: Company }; t: Dictionary; score?: number }) {
  return (
    <article className="group hover:bg-muted/60 relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 px-4 py-5 transition-colors sm:px-5">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Link
            href={`/companies/${job.company.slug}`}
            className="text-foreground relative z-10 -my-2 inline-flex min-h-11 items-center truncate font-bold hover:underline sm:min-h-0"
          >
            {job.company.name}
          </Link>
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
            {job.title}
          </Link>
        </h3>
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
        <SalaryChip estimate={estimateSalary({ job, company: job.company })} s={salaryStrings(localeOf(t))} />
        {job.techStack.length > 0 && (
          <ul className="flex flex-wrap gap-1 pt-1" dir="ltr" aria-label={t.jobs.tech}>
            {job.techStack.slice(0, 6).map((s) => (
              <li key={s} className="chip">
                {s}
              </li>
            ))}
            {job.techStack.length > 6 && <li className="chip bg-transparent">+{job.techStack.length - 6}</li>}
          </ul>
        )}
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
  return <div className="bg-card divide-border divide-y overflow-hidden rounded-lg border">{children}</div>;
}
