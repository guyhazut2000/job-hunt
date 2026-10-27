import { Plus } from "lucide-react";
import { addManualApplication } from "@/app/actions";
import { Kanban } from "@/components/Kanban";
import { Button } from "@/components/ui/button";
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
  const active = items.filter((i) => !["SAVED", "REJECTED"].includes(i.status)).length;
  return (
    <div className="flex flex-col gap-6">
      <header className="rule-double flex flex-wrap items-end justify-between gap-3 pb-4">
        <div>
          <p className="kicker">{t.ui.tracker}</p>
          <h1 className="text-title mt-1 font-black">{t.dashboard.title}</h1>
        </div>
        <dl className="flex gap-5 text-sm">
          <div>
            <dt className="text-muted-foreground">{t.ui.total}</dt>
            <dd className="font-mono text-xl font-medium">{items.length}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.ui.inProcess}</dt>
            <dd className="text-fit font-mono text-xl font-medium">{active}</dd>
          </div>
        </dl>
      </header>

      <details className="group bg-card rounded-lg border" open={items.length === 0}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-semibold [&::-webkit-details-marker]:hidden">
          <Plus className="text-primary size-4 transition-transform group-open:rotate-45" aria-hidden />
          {t.dashboard.addManual}
        </summary>
        <form
          action={addManualApplication}
          className="grid gap-3 border-t p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
        >
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
          <Button type="submit">{t.dashboard.add}</Button>
        </form>
      </details>

      {items.length === 0 && <p className="text-muted-foreground">{t.dashboard.empty}</p>}
      <Kanban
        items={items}
        labels={t.status}
        removeLabel={t.dashboard.remove}
        statusLabel={t.ui.status}
        emptyLabel={t.ui.emptyColumn}
      />
    </div>
  );
}
