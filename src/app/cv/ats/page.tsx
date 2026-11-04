import Link from "next/link";
import { AtsView } from "@/components/ats/AtsView";
import { Button } from "@/components/ui/button";
import { atsJobOptions, loadAtsJob, runAts } from "@/lib/ats/server";
import { getLocale } from "@/lib/i18n";
import { getAtsStrings } from "@/lib/i18n/ats";
import { localizedTitle } from "@/lib/i18n/titles";
import { requireUser } from "@/lib/session";

export const generateMetadata = localizedTitle("cvAts");

/** ATS / screening-filter readiness check of the exported CV (#115). */
export default async function CvAtsPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; template?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser("/cv/ats");
  const locale = await getLocale();
  const t = getAtsStrings(locale);
  const jobId = typeof sp.job === "string" && sp.job.length <= 64 ? sp.job : null;
  const template = typeof sp.template === "string" && sp.template.length <= 40 ? sp.template : null;
  const [jobs, job] = await Promise.all([atsJobOptions(user.id), jobId ? loadAtsJob(user.id, jobId) : null]);
  const run = await runAts(user.id, { template, job });

  return (
    <div className="flex flex-col gap-6" data-testid="cv-ats-page">
      <header className="rule-double flex flex-col gap-2 pb-4">
        <p className="kicker">{t.kicker}</p>
        <h1 className="font-heading text-title font-black">{t.title}</h1>
        <p className="text-muted-foreground max-w-3xl">{t.lead}</p>
        <p className="bg-muted max-w-3xl rounded-md p-3 text-sm" data-testid="ats-not-vendor">
          {t.notVendor}
        </p>
        <Link href="/cv/standard" className="text-primary self-start text-sm font-semibold underline">
          {t.toStandard}
        </Link>
      </header>
      {run.empty ? (
        <div className="flex flex-col gap-3" data-testid="cv-ats-empty">
          <p className="bg-caution-soft text-caution rounded-md border p-3 text-sm">{t.empty}</p>
          <Button asChild className="self-start">
            <Link href="/profile">{t.toProfile}</Link>
          </Button>
        </div>
      ) : (
        <AtsView
          key={`${jobId ?? "none"}-${template ?? ""}`}
          locale={locale}
          initial={run}
          jobs={jobs}
          jobId={job ? jobId : null}
          template={template}
        />
      )}
      <nav className="flex flex-wrap gap-x-4 gap-y-2 border-t pt-4 text-sm" aria-label={t.related}>
        <Link href="/learn/gaps" className="text-primary font-semibold underline">
          {t.relatedGaps}
        </Link>
        <Link href="/cv/tailor" className="text-primary font-semibold underline">
          {t.relatedTailor}
        </Link>
      </nav>
    </div>
  );
}
