import { addManualApplication } from "@/app/actions";
import { Kanban } from "@/components/Kanban";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const { t } = await getDictionary();
  const items = await db.application.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, company: true, url: true, jobId: true, status: true },
  });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t.dashboard.title}</h1>
      <form action={addManualApplication} className="card grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <div className="text-sm font-medium sm:col-span-4">{t.dashboard.addManual}</div>
        <div>
          <label className="label" htmlFor="title">
            {t.dashboard.jobTitle}
          </label>
          <input id="title" name="title" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="company">
            {t.dashboard.company}
          </label>
          <input id="company" name="company" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="url">
            {t.dashboard.url}
          </label>
          <input id="url" name="url" type="url" className="input" dir="ltr" />
        </div>
        <button className="btn-primary" type="submit">
          {t.dashboard.add}
        </button>
      </form>
      {items.length === 0 && <p className="text-slate-600">{t.dashboard.empty}</p>}
      <Kanban items={items} labels={t.status} removeLabel={t.dashboard.remove} />
    </div>
  );
}
