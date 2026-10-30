import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { GenerateForm } from "@/components/cv-tailor/GenerateForm";
import { VersionList } from "@/components/cv-tailor/VersionList";
import { aiRemaining } from "@/lib/ai/remaining";
import { isEmptyCv } from "@/lib/cv-tailor/base";
import { detectLanguage } from "@/lib/cv-tailor/match";
import { loadBaseCv, resolveTarget, versionsFor } from "@/lib/cv-tailor/server";
import { getLocale } from "@/lib/i18n";
import { cvTailorStrings } from "@/lib/i18n/cv-tailor";
import { fmt } from "@/lib/i18n/learning";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tailored CV" };

export default async function TailorStartPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; app?: string }>;
}) {
  const user = await requireUser();
  const locale = await getLocale();
  const t = cvTailorStrings(locale);
  const { job, app } = await searchParams;
  const resolved = job || app ? await resolveTarget(user.id, { jobId: job, applicationId: app }) : null;
  if (!resolved) {
    return (
      <div className="flex flex-col gap-4">
        <p className="kicker">{t.kicker}</p>
        <h1 className="font-heading text-title font-black">{t.title}</h1>
        <p className="text-muted-foreground">{t.notFound}</p>
        <Link href="/dashboard" className="text-primary font-semibold underline underline-offset-4">
          /dashboard
        </Link>
      </div>
    );
  }
  const { target, jobId, applicationId, needsText } = resolved;
  const [{ base }, versions, remaining] = await Promise.all([
    loadBaseCv(user.id, locale),
    versionsFor(user.id, jobId, applicationId),
    aiRemaining(user.id),
  ]);
  const detected = detectLanguage(`${target.title}\n${target.description}`);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header className="rule-double flex flex-col gap-1 pb-4">
        <p className="kicker">{t.kicker}</p>
        <h1 className="font-heading text-title font-black">{t.title}</h1>
        <p className="text-lg font-semibold" dir="auto">
          {fmt(t.forJob, { title: target.title, company: target.company })}
        </p>
        <p className="text-muted-foreground max-w-[65ch]">{t.lead}</p>
        {jobId && (
          <Link
            href={`/jobs/${jobId}`}
            className="text-primary inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold"
          >
            <ArrowLeft className="size-4 rotate-180 ltr:rotate-0" aria-hidden />
            {t.backToJob}
          </Link>
        )}
      </header>
      {isEmptyCv(base) ? (
        <div className="bg-caution-soft flex flex-col gap-3 rounded-xl p-4" data-testid="cvt-nobase">
          <p>{t.noBase}</p>
          <Link href="/profile?tab=documents" className="text-primary w-fit font-semibold underline underline-offset-4">
            {t.noBaseCta}
          </Link>
        </div>
      ) : (
        <section className="bg-card flex flex-col gap-4 rounded-xl border p-4 sm:p-5">
          <p className="text-muted-foreground text-sm">{t.rules}</p>
          <p className="text-muted-foreground text-xs" data-testid="cvt-remaining">
            {remaining == null ? t.aiOff : fmt(t.remaining, { n: remaining })}
          </p>
          <GenerateForm
            jobId={jobId}
            applicationId={jobId ? null : applicationId}
            detected={detected}
            needsText={needsText}
            regenerate={versions.length > 0}
            t={t}
          />
        </section>
      )}
      <section className="flex flex-col gap-2">
        <h2 className="inline-flex items-center gap-1.5 font-bold">
          <FileText className="text-primary size-4" aria-hidden />
          {t.versions}
        </h2>
        {versions.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.noVersions}</p>
        ) : (
          <VersionList versions={versions} t={t} locale={locale} />
        )}
      </section>
    </div>
  );
}
