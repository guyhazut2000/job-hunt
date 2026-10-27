import { adminAddCompany, adminSyncAll } from "@/app/actions";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { SUPPORTED_PROVIDERS } from "@/lib/ingestion/registry";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();
  const { t } = await getDictionary();
  const [users, jobs, companies, applications, runs] = await Promise.all([
    db.user.count(),
    db.job.count({ where: { isActive: true } }),
    db.company.count(),
    db.application.count(),
    db.ingestionRun.findMany({ orderBy: { startedAt: "desc" }, take: 15 }),
  ]);
  const stats = [
    [t.admin.users, users],
    [t.admin.jobs, jobs],
    [t.admin.companies, companies],
    [t.admin.applications, applications],
  ] as const;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t.admin.title}</h1>
      <div className="grid gap-4 sm:grid-cols-4">
        {stats.map(([label, n]) => (
          <div key={label} className="card">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="text-2xl font-bold">{n}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <form action={adminAddCompany} className="card space-y-3">
          <h2 className="font-semibold">{t.admin.addCompany}</h2>
          <input name="name" required placeholder={t.admin.name} className="input" />
          <select name="provider" className="input" aria-label={t.admin.provider}>
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
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t.admin.runs}</h2>
            <form action={adminSyncAll}>
              <button className="btn-ghost" type="submit">
                {t.admin.syncAll}
              </button>
            </form>
          </div>
          <table className="w-full text-start text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="text-start">provider</th>
                <th className="text-start">started</th>
                <th>+</th>
                <th>~</th>
                <th>−</th>
                <th className="text-start">error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td>{r.provider}</td>
                  <td>{r.startedAt.toLocaleString("he-IL")}</td>
                  <td className="text-center">{r.created}</td>
                  <td className="text-center">{r.updated}</td>
                  <td className="text-center">{r.deactivated}</td>
                  <td className="max-w-40 truncate text-red-600" title={r.error ?? ""}>
                    {r.error}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
