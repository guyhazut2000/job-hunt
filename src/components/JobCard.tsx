import Link from "next/link";
import type { Company, Job } from "@prisma/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { MatchBadge } from "./MatchBadge";

export function JobCard({ job, t, score }: { job: Job & { company: Company }; t: Dictionary; score?: number }) {
  return (
    <article className="card flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <Link href={`/jobs/${job.id}`} className="hover:text-brand-600 text-base font-semibold">
          {job.title}
        </Link>
        <div className="text-sm text-slate-600">
          <Link href={`/companies/${job.company.slug}`} className="hover:underline">
            {job.company.name}
          </Link>
          {" · "}
          {job.location} · {t.workMode[job.workMode]} · {t.seniority[job.seniority]}
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1" dir="ltr">
          {job.techStack.slice(0, 8).map((s) => (
            <span key={s} className="chip">
              {s}
            </span>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
        {score !== undefined && <MatchBadge score={score} label={t.jobs.match} />}
        <time className="text-xs text-slate-500" dateTime={job.postedAt.toISOString()}>
          {job.postedAt.toLocaleDateString("he-IL")}
        </time>
      </div>
    </article>
  );
}
