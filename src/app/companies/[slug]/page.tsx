import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ExternalLink } from "lucide-react";
import { JobCard, JobList } from "@/components/JobCard";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const c = await db.company.findUnique({ where: { slug: (await params).slug } });
  return { title: c?.name ?? "Company" };
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t } = await getDictionary();
  const company = await db.company.findUnique({
    where: { slug },
    include: { jobs: { where: { isActive: true }, orderBy: { postedAt: "desc" }, include: { company: true } } },
  });
  if (!company) notFound();
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
          {company.website && (
            <a
              className="text-primary inline-flex min-h-11 items-center gap-1 font-semibold underline-offset-4 hover:underline"
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.companies.website}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
          {company.lastSyncedAt && (
            <span className="text-muted-foreground font-mono text-xs">
              {t.companies.lastSync}: {formatDateTime(company.lastSyncedAt, t.dateLocale)}
            </span>
          )}
        </div>
      </header>
      <h2 className="font-heading text-xl font-bold">
        <span className="font-mono">{company.jobs.length}</span> {t.companies.openRoles}
      </h2>
      {company.jobs.length > 0 && (
        <JobList>
          {company.jobs.map((j) => (
            <JobCard key={j.id} job={j} t={t} />
          ))}
        </JobList>
      )}
    </div>
  );
}
