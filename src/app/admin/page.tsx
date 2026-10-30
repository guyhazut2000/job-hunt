import { formatDateTime } from "@/lib/format";
import {
  adminAddCompany,
  adminApproveCandidate,
  adminRejectCandidate,
  adminRunDiscovery,
  adminSetSyncMode,
  adminSyncAll,
} from "@/app/actions";
import { CompanyLinkedinForm } from "@/components/admin/CompanyLinkedinForm";
import { CompanyOfficeForm } from "@/components/admin/CompanyOfficeForm";
import { ManualCompanyForm } from "@/components/admin/ManualCompanyForm";
import { PendingButton } from "@/components/admin/PendingButton";
import { careersLink, isManualCompany, isSyncFailing, SYNC_FAILING_THRESHOLD } from "@/lib/companies/status";
import { db } from "@/lib/db";
import { USER_SOURCE } from "@/lib/discovery/suggest";
import { getDictionary } from "@/lib/i18n";
import { jobsMapStrings } from "@/lib/i18n/jobs-map";
import { linkedinStrings } from "@/lib/i18n/linkedin";
import { SUPPORTED_PROVIDERS } from "@/lib/ingestion/registry";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";
// "Sync all" and "Run discovery" server actions run for up to ~4 minutes.
export const maxDuration = 300;
export const metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin("/admin");
  const { t, locale } = await getDictionary();
  const [users, jobs, companies, applications, runs, perSource, companyList, manualList, autoList, discovery] =
    await Promise.all([
      db.user.count(),
      db.job.count({ where: { isActive: true } }),
      db.company.count(),
      db.application.count(),
      db.ingestionRun.findMany({ orderBy: { startedAt: "desc" }, take: 15 }),
      sourceStats(),
      db.company.findMany({
        select: { id: true, name: true, linkedinUrl: true, officeAddress: true },
        orderBy: { name: "asc" },
      }),
      manualCompanies(),
      db.company.findMany({
        where: { syncMode: "AUTO", atsProvider: { not: "MANUAL" }, atsBoardId: { not: null } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      discoveryStats(),
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
        <div className="scroll-thin -mx-4 overflow-x-auto px-4">
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
      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
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
        <CompanyOfficeForm companies={companyList} s={jobsMapStrings(locale)} />
        <div className="card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t.admin.runs}</h2>
            <form action={adminSyncAll}>
              <button className="btn-ghost" type="submit">
                {t.admin.syncAll}
              </button>
            </form>
          </div>
          <div className="scroll-thin -mx-4 overflow-x-auto px-4">
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
      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <ManualCompanyForm
          labels={{
            title: t.admin.addManual,
            hint: t.admin.addManualHint,
            name: t.admin.name,
            website: t.admin.website,
            careersUrl: t.admin.careersUrl,
            notesHe: t.admin.notesHe,
            notesEn: t.admin.notesEn,
            submit: t.admin.save,
          }}
        />
        <form action={adminSetSyncMode} className="card flex flex-col gap-3">
          <h2 className="font-semibold">{t.admin.switchCompany}</h2>
          <input type="hidden" name="mode" value="MANUAL" />
          <label className="label" htmlFor="switch-company">
            {t.admin.chooseCompany}
          </label>
          <select
            id="switch-company"
            name="companyId"
            required
            className="select-native w-full max-w-full"
            defaultValue=""
          >
            <option value="" disabled>
              {t.admin.chooseCompany}
            </option>
            {autoList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="btn-ghost min-h-11 self-start" type="submit">
            {t.admin.makeManual}
          </button>
        </form>
      </div>
      <section className="card flex flex-col gap-3" aria-labelledby="manual-heading" data-admin-manual>
        <h2 id="manual-heading" className="font-semibold">
          {t.admin.manualCompanies} <span className="text-muted-foreground font-normal">({manualList.total})</span>
        </h2>
        {manualList.total > manualList.rows.length && (
          <p className="text-muted-foreground text-sm">
            {t.admin.showingFirst.replace("{n}", String(manualList.rows.length))}
          </p>
        )}
        <div className="scroll-thin relative -mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[40rem] text-start text-sm">
            <thead className="text-muted-foreground text-xs">
              <tr>
                <th className="text-start font-medium">{t.admin.name}</th>
                <th className="text-start font-medium">{t.admin.mode}</th>
                <th className="text-start font-medium">{t.admin.careersUrl}</th>
                <th className="text-start font-medium">{t.admin.lastError}</th>
                <th className="sr-only">{t.admin.mode}</th>
              </tr>
            </thead>
            <tbody>
              {manualList.rows.map((c) => {
                const manual = isManualCompany(c);
                const link = careersLink(c);
                const canAuto = manual && c.syncMode === "MANUAL" && c.atsProvider !== "MANUAL" && !!c.atsBoardId;
                return (
                  <tr key={c.id} className="border-border border-t align-top">
                    <td className="py-2 font-medium">
                      <a href={`/companies/${c.slug}`} className="hover:underline">
                        {c.name}
                      </a>
                    </td>
                    <td className="py-2">
                      {manual ? (
                        t.admin.manual
                      ) : (
                        <span className="text-destructive">
                          {t.admin.auto} · {c.syncFailures}× ✕
                        </span>
                      )}
                    </td>
                    <td className="max-w-56 truncate py-2" dir="ltr">
                      {link && (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {link.replace(/^https?:\/\//, "")}
                        </a>
                      )}
                    </td>
                    <td
                      className="text-destructive max-w-48 truncate py-2 font-mono text-xs"
                      title={c.lastSyncError ?? ""}
                    >
                      {c.lastSyncError}
                    </td>
                    <td className="py-1 text-end">
                      {(!manual || canAuto) && (
                        <form action={adminSetSyncMode}>
                          <input type="hidden" name="companyId" value={c.id} />
                          <input type="hidden" name="mode" value={manual ? "AUTO" : "MANUAL"} />
                          <button className="btn-ghost min-h-11 text-xs" type="submit">
                            {manual ? t.admin.makeAuto : t.admin.makeManual}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card flex flex-col gap-3" aria-labelledby="discovery-heading" data-admin-discovery>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="discovery-heading" className="font-semibold">
            {t.admin.discovery}
          </h2>
          <form action={adminRunDiscovery}>
            <PendingButton pendingLabel={t.admin.running}>{t.admin.runDiscovery}</PendingButton>
          </form>
        </div>
        <p className="text-muted-foreground text-sm">{t.admin.discoveryHint}</p>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {(
            [
              [t.admin.candidates, discovery.total],
              [t.admin.added, discovery.added],
              [t.admin.pending, discovery.pendingChecked],
              [t.admin.rejected, discovery.rejected],
            ] as const
          ).map(([label, n]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-xl font-bold tabular-nums">{n}</dd>
            </div>
          ))}
        </dl>
        {discovery.lastRun && (
          <p className="text-muted-foreground text-xs">
            {t.admin.lastRun}: {formatDateTime(discovery.lastRun.startedAt, t.dateLocale)} ({t.admin.israelTime}) ·{" "}
            {t.admin.checked} {discovery.lastRun.checked} · {t.admin.added} {discovery.lastRun.addedAuto}
            {discovery.lastRun.error && <span className="text-destructive"> · {discovery.lastRun.error}</span>}
          </p>
        )}
        <h3 className="text-sm font-semibold">{t.admin.pending}</h3>
        {discovery.queue.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.admin.noPending}</p>
        ) : (
          <ul className="divide-border divide-y" data-discovery-queue>
            {discovery.queue.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {c.name}{" "}
                    <span className="text-muted-foreground text-xs">
                      · {c.source}
                      {c.size ? ` · ${c.size}` : ""}
                      {c.industry ? ` · ${c.industry}` : ""}
                    </span>
                  </div>
                  <a
                    href={c.careersUrl ?? c.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-xs break-all hover:underline"
                    dir="ltr"
                  >
                    {(c.careersUrl ?? c.website).replace(/^https?:\/\//, "")}
                  </a>
                  {(c.detectedProvider || c.checkError) && (
                    <div className="text-muted-foreground text-xs">
                      {c.detectedProvider
                        ? `${t.admin.detected}: ${c.detectedProvider} · ${t.admin.israelJobs}: ${c.israelJobs ?? 0}`
                        : c.checkError}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <form action={adminApproveCandidate}>
                    <input type="hidden" name="candidateId" value={c.id} />
                    <button className="btn-ghost min-h-11 text-xs" type="submit">
                      {t.admin.approveManual}
                    </button>
                  </form>
                  <form action={adminRejectCandidate}>
                    <input type="hidden" name="candidateId" value={c.id} />
                    <button className="btn-ghost text-muted-foreground min-h-11 text-xs" type="submit">
                      {t.admin.reject}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted-foreground text-xs">
          {t.admin.sourceCredit}{" "}
          <a href="https://github.com/mluggy/techmap" target="_blank" rel="noopener noreferrer" className="underline">
            github.com/mluggy/techmap
          </a>
        </p>
      </section>
    </div>
  );
}

/** Manual companies and AUTO companies whose feed keeps failing — never hidden, listed here for review. */
async function manualCompanies() {
  const where = {
    OR: [
      { syncMode: "MANUAL" as const },
      { atsProvider: "MANUAL" as const },
      { atsBoardId: null },
      { syncFailures: { gte: SYNC_FAILING_THRESHOLD } },
    ],
  };
  const [total, rows] = await Promise.all([
    db.company.count({ where }),
    db.company.findMany({
      where,
      select: {
        id: true,
        slug: true,
        name: true,
        website: true,
        careersUrl: true,
        syncMode: true,
        atsProvider: true,
        atsBoardId: true,
        syncFailures: true,
        lastSyncError: true,
      },
      orderBy: [{ syncFailures: "desc" }, { name: "asc" }],
      take: 150,
    }),
  ]);
  return { total, rows: rows.sort((a, b) => Number(isSyncFailing(b)) - Number(isSyncFailing(a))) };
}

/** Checked candidates waiting for a decision, plus user suggestions (shown right away, even before their check). */
const REVIEW_QUEUE = {
  status: "PENDING" as const,
  OR: [{ checkedAt: { not: null } }, { source: USER_SOURCE }],
};

async function discoveryStats() {
  const [byStatus, pendingChecked, queue, lastRun] = await Promise.all([
    db.startupCandidate.groupBy({ by: ["status"], _count: { _all: true } }),
    db.startupCandidate.count({ where: REVIEW_QUEUE }),
    db.startupCandidate.findMany({
      where: REVIEW_QUEUE,
      orderBy: [{ priority: "desc" }, { name: "asc" }],
      take: 30,
    }),
    db.discoveryRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);
  const n = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  return {
    total: byStatus.reduce((sum, b) => sum + b._count._all, 0),
    added: n("ADDED"),
    rejected: n("REJECTED"),
    pendingChecked,
    queue,
    lastRun,
  };
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
