import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { CvTips } from "@/components/CvTips";
import { MatchBadge } from "@/components/MatchBadge";
import { SaveJobButton } from "@/components/SaveJobButton";
import { computeMatch } from "@/lib/ai/match";
import { track } from "@/lib/analytics";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const job = await db.job.findUnique({ where: { id: (await params).id }, include: { company: true } });
  return { title: job ? `${job.title} @ ${job.company.name}` : "Job" };
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ t }, session] = await Promise.all([getDictionary(), auth()]);
  const job = await db.job.findUnique({ where: { id }, include: { company: true } });
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

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <article className="card space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <p className="text-slate-600">
            <Link href={`/companies/${job.company.slug}`} className="hover:underline">
              {job.company.name}
            </Link>
            {" · "}
            {job.location} · {t.workMode[job.workMode]} · {t.seniority[job.seniority]} · {t.roles[job.roleCategory]}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" dir="ltr">
          {job.techStack.map((s) => (
            <span key={s} className="chip">
              {s}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
            {t.jobs.apply} ↗
          </a>
          {userId && (
            <SaveJobButton jobId={job.id} saved={!!application} label={t.jobs.save} savedLabel={t.jobs.saved} />
          )}
        </div>
        <div className="text-sm leading-relaxed whitespace-pre-line text-slate-700" dir="auto">
          {job.description}
        </div>
      </article>
      <aside className="space-y-4">
        {match ? (
          <div className="card space-y-3">
            <MatchBadge score={match.score} label={t.jobs.match} />
            {match.matchedSkills.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-medium">{t.jobs.matchedSkills}</h3>
                <div className="flex flex-wrap gap-1" dir="ltr">
                  {match.matchedSkills.map((s) => (
                    <span key={s} className="chip bg-emerald-50 text-emerald-700">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {match.missingSkills.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-medium">{t.jobs.missingSkills}</h3>
                <div className="flex flex-wrap gap-1" dir="ltr">
                  {match.missingSkills.map((s) => (
                    <span key={s} className="chip bg-amber-50 text-amber-700">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="card text-sm text-slate-600">{t.jobs.matchLoginHint}</p>
        )}
        {userId && <CvTips jobId={job.id} label={t.jobs.generate} title={t.jobs.cvTips} />}
      </aside>
    </div>
  );
}
