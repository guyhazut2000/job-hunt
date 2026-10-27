import { formatDateTime } from "@/lib/format";
import { adminAddCompany, adminSyncAll } from "@/app/actions";
import { CompanyLinkedinForm } from "@/components/admin/CompanyLinkedinForm";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { linkedinStrings } from "@/lib/i18n/linkedin";
import { SUPPORTED_PROVIDERS } from "@/lib/ingestion/registry";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();
  const { t, locale } = await getDictionary();
  const [users, jobs, companies, applications, runs, perSource, companyList] = await Promise.all([
    db.user.count(),
    db.job.count({ where: { isActive: true } }),
    db.company.count(),
    db.application.count(),
    db.ingestionRun.findMany({ orderBy: { startedAt: "desc" }, take: 15 }),
    sourceStats(),
    db.company.findMany({ select: { id: true, name: true, linkedinUrl: true }, orderBy: { name: "asc" } }),
  ]);
  const stats = [
    [t.admin.users, users],
    [t.admin.jobs, jobs],
    [t.admin.companies, companies],
    [t.admin.applications, applications],
  ] as const;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title font-black">{t.admin.title}</h1>
      <div className="grid gap-4 sm:grid-cols-4">
        {stats.map(([label, n]) => (
          <div key={label} className="card">
            <div className="text-muted-foreground text-sm">{label}</div>
            <div className="text-2xl font-bold">{n}</div>
          </div>
        ))}
      </div>
      <section className="card flex flex-col gap-3" aria-labelledby="sources-heading">
        <h2 id="sources-heading" className="font-semibold">
          {t.admin.sources}
        </h2>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[30rem] text-start text-sm">
            <thead className="text-muted-foreground text-xs">
              <tr>
                <th className="text-start font-medium">{t.admin.source}</th>
                <th className="text-end font-medium">{t.admin.companies}</th>
                <th className="text-end font-medium">{t.admin.activeJobs}</th>
                <th className="text-end font-medium">{t.admin.failures}</th>
                <th className="ps-4 text-start font-medium">
                  {t.admin.lastSync} <span className="font-normal">({t.admin.israelTime})</span>
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {perSource.map((s) => (
                <tr key={s.provider} className="border-border border-t">
                  <td className="py-2 font-mono text-xs">{s.provider}</td>
                  <td className="text-end">{s.companies}</td>
                  <td className="text-end">{s.activeJobs}</td>
                  <td className={s.failures ? "text-destructive text-end" : "text-end"}>{s.failures}</td>
                  <td className="ps-4">{s.lastSync ? formatDateTime(s.lastSync, t.dateLocale) : t.admin.never}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <form action={adminAddCompany} className="card flex flex-col gap-3">
          <h2 className="font-semibold">{t.admin.addCompany}</h2>
          <input name="name" required placeholder={t.admin.name} className="input" />
          <select name="provider" className="select-native" aria-label={t.admin.provider}>
            {SUPPORTED_PROVIDERS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <input name="boardId" required placeholder={t.admin.boardId} className="input" dir="ltr" />
          <input name="website" type="url" placeholder="https://" className="input" dir="ltr" />
          <button className="btn-primary" type="submit">
            {t.admin.add}
          </button>
        </form>
        <CompanyLinkedinForm companies={companyList} s={linkedinStrings(locale)} />
        <div className="card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t.admin.runs}</h2>
            <form action={adminSyncAll}>
              <button className="btn-ghost" type="submit">
                {t.admin.syncAll}
              </button>
            </form>
          </div>
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[32rem] text-start font-mono text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-start">provider</th>
                  <th className="text-start">
                    {t.admin.started} <span className="font-normal">({t.admin.israelTime})</span>
                  </th>
                  <th>+</th>
                  <th>~</th>
                  <th>−</th>
                  <th className="text-start">error</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-border border-t">
                    <td className="py-2">{r.provider}</td>
                    <td className="py-2">{formatDateTime(r.startedAt, t.dateLocale)}</td>
                    <td className="text-center">{r.created}</td>
                    <td className="text-center">{r.updated}</td>
                    <td className="text-center">{r.deactivated}</td>
                    <td className="text-destructive max-w-40 truncate" title={r.error ?? ""}>
                      {r.error}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Per ATS: configured companies, active jobs, latest successful sync, and boards whose latest run failed. */
async function sourceStats() {
  const [companies, jobs, latestRuns] = await Promise.all([
    db.company.groupBy({
      by: ["atsProvider"],
      where: { atsProvider: { not: "MANUAL" } },
      _count: { _all: true },
      _max: { lastSyncedAt: true },
    }),
    db.job.groupBy({ by: ["source"], where: { isActive: true }, _count: { _all: true } }),
    db.ingestionRun.findMany({
      where: { companyId: { not: null }, startedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
      orderBy: { startedAt: "desc" },
      distinct: ["companyId"],
      select: { provider: true, error: true },
    }),
  ]);
  const providers = new Set([...SUPPORTED_PROVIDERS, ...companies.map((c) => c.atsProvider)]);
  return [...providers]
    .map((provider) => {
      const c = companies.find((x) => x.atsProvider === provider);
      return {
        provider,
        companies: c?._count._all ?? 0,
        activeJobs: jobs.find((j) => j.source === provider)?._count._all ?? 0,
        lastSync: c?._max.lastSyncedAt ?? null,
        failures: latestRuns.filter((r) => r.provider === provider && r.error).length,
      };
    })
    .sort((a, b) => b.activeJobs - a.activeJobs);
}
