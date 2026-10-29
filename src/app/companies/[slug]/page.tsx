import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowRight, ExternalLink, Hand } from "lucide-react";
import { auth } from "@/auth";
import { JobCard, JobList } from "@/components/JobCard";
import { LinkedinCompanyLinks } from "@/components/LinkedinCompanyLink";
import { People } from "@/components/outreach/People";
import { CompanySalaryBands } from "@/components/salary/CompanySalaryBands";
import { HiringProcessSection } from "@/components/hiring/HiringProcessSection";
import { careersLink, isManualCompany, isSyncFailing, safeHttpUrl } from "@/lib/companies/status";
import { db } from "@/lib/db";
import { MAX_FOLLOWED_COMPANIES } from "@/lib/notifications/company-follow";
import { formatDateTime } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { linkedinStrings } from "@/lib/i18n/linkedin";
import { BackToTop } from "@/components/BackToTop";
import { FollowCompanyButton } from "@/components/notifications/FollowCompanyButton";
import { fill, notificationStrings } from "@/lib/i18n/notifications";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const c = await db.company.findUnique({ where: { slug: (await params).slug } });
  return { title: c?.name ?? "Company" };
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [{ t, locale }, session] = await Promise.all([getDictionary(), auth()]);
  const company = await db.company.findUnique({
    where: { slug },
    include: { jobs: { where: { isActive: true }, orderBy: { postedAt: "desc" }, include: { company: true } } },
  });
  if (!company) notFound();
  const manual = isManualCompany(company);
  const failing = isSyncFailing(company);
  const careers = careersLink(company);
  const website = safeHttpUrl(company.website);
  const note = (locale === "he" ? company.notesHe : company.notesEn) ?? company.notesHe ?? company.notesEn;
  const userId = session?.user?.id;
  const following = userId
    ? Boolean(
        await db.companyFollow.findUnique({
          where: { userId_companyId: { userId, companyId: company.id } },
          select: { id: true },
        }),
      )
    : false;
  const ns = notificationStrings(locale);
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/companies"
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold"
      >
        <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
        {t.companies.title}
      </Link>
      <header className="rule-double flex flex-col gap-3 pb-6">
        <p className="kicker">{[company.industry, company.size, company.hqLocation].filter(Boolean).join(" · ")}</p>
        <h1 className="text-title font-black">{company.name}</h1>
        {company.description && (
          <p className="text-foreground/85 max-w-[68ch] text-lg leading-relaxed" dir="auto">
            {company.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {userId && (
            <FollowCompanyButton
              companyId={company.id}
              initial={following}
              labels={{
                follow: ns.follow,
                following: ns.following,
                unfollow: ns.unfollow,
                hint: fill(ns.followHint, { company: company.name }),
                limit: fill(ns.followLimit, { n: MAX_FOLLOWED_COMPANIES }),
              }}
            />
          )}
          {website && (
            <a
              className="text-primary inline-flex min-h-11 items-center gap-1 font-semibold underline-offset-4 hover:underline"
              href={website}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.companies.website}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
          {careers && careers !== website && (
            <a
              className="text-primary inline-flex min-h-11 items-center gap-1 font-semibold underline-offset-4 hover:underline"
              href={careers}
              target="_blank"
              rel="noopener noreferrer"
              data-careers-link
            >
              {t.companies.careersSite}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
          <LinkedinCompanyLinks company={company} s={linkedinStrings(locale)} />
          {company.lastSyncedAt && (
            <span className="text-muted-foreground font-mono text-xs">
              {t.companies.lastSync}: {formatDateTime(company.lastSyncedAt, t.dateLocale)}
            </span>
          )}
        </div>
      </header>
      {(manual || failing) && (
        <section
          data-manual-notice={manual ? "manual" : "failing"}
          aria-labelledby="sync-notice-h"
          className={
            manual
              ? "border-primary/40 bg-primary/5 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:gap-4"
              : "border-destructive/40 bg-destructive/5 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:gap-4"
          }
        >
          {manual ? (
            <Hand className="text-primary size-6 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="text-destructive size-6 shrink-0" aria-hidden />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h2 id="sync-notice-h" className="font-heading text-lg leading-tight font-bold">
              {manual ? t.companies.manualTitle : t.companies.failingTitle}
            </h2>
            <p className="text-foreground/85 max-w-[68ch] leading-relaxed">
              {manual ? t.companies.manualBody : t.companies.failingBody}
            </p>
            {note && (
              <p className="text-muted-foreground max-w-[68ch] text-sm" dir="auto">
                {note}
              </p>
            )}
            {failing && company.lastSyncError && (
              <p className="text-muted-foreground font-mono text-xs wrap-anywhere" dir="ltr">
                {t.companies.lastError}: {company.lastSyncError}
              </p>
            )}
            {careers && (
              <a
                href={careers}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-primary text-primary-foreground hover:bg-primary/90 mt-1 inline-flex min-h-11 w-fit items-center gap-2 rounded-md px-4 text-sm font-semibold"
              >
                {t.companies.openCareers}
                <ExternalLink className="size-4" aria-hidden />
              </a>
            )}
          </div>
        </section>
      )}
      <People company={company} userId={session?.user?.id} t={t} />
      <CompanySalaryBands company={company} jobs={company.jobs} loggedIn={!!session?.user?.id} locale={locale} />
      <HiringProcessSection
        companyId={company.id}
        companyName={company.name}
        techStack={[...new Set(company.jobs.flatMap((j) => j.techStack))]}
        userId={session?.user?.id}
        locale={locale}
      />
      <h2 className="font-heading border-rule border-t-2 pt-6 text-xl font-bold">
        <span className="font-mono">{company.jobs.length}</span> {t.companies.openRoles}
      </h2>
      {company.jobs.length > 0 && (
        <JobList>
          {company.jobs.map((j) => (
            <JobCard key={j.id} job={j} t={t} />
          ))}
        </JobList>
      )}
      <BackToTop label={t.ui.backToTop} />
    </div>
  );
}
