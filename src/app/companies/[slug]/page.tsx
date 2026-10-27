import { notFound } from "next/navigation";
import { JobCard } from "@/components/JobCard";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t } = await getDictionary();
  const company = await db.company.findUnique({
    where: { slug },
    include: { jobs: { where: { isActive: true }, orderBy: { postedAt: "desc" }, include: { company: true } } },
  });
  if (!company) notFound();
  return (
    <div className="space-y-6">
      <header className="card space-y-2">
        <h1 className="text-2xl font-bold">{company.name}</h1>
        <p className="text-sm text-slate-500">
          {[company.industry, company.size, company.hqLocation].filter(Boolean).join(" · ")}
        </p>
        {company.description && (
          <p className="text-slate-700" dir="auto">
            {company.description}
          </p>
        )}
        <div className="flex gap-4 text-sm">
          {company.website && (
            <a
              className="text-brand-600 hover:underline"
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.companies.website} ↗
            </a>
          )}
          {company.lastSyncedAt && (
            <span className="text-slate-500">
              {t.companies.lastSync}: {company.lastSyncedAt.toLocaleString("he-IL")}
            </span>
          )}
        </div>
      </header>
      <h2 className="text-lg font-semibold">
        {company.jobs.length} {t.companies.openRoles}
      </h2>
      <div className="space-y-3">
        {company.jobs.map((j) => (
          <JobCard key={j.id} job={j} t={t} />
        ))}
      </div>
    </div>
  );
}
