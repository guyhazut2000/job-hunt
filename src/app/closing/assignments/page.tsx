import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { closingStrings, fillC, type ClosingStrings } from "@/lib/i18n/closing";
import { localizedTitle } from "@/lib/i18n/titles";
import { ASSIGNMENT_STATUSES, dateToIsraelLocal, dueState, sortByDue, type DueState } from "@/lib/closing/assignments";
import { requireUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, fieldCls, fmtWhen, selectCls } from "@/components/closing/ui";
import { cn } from "@/lib/utils";
import { deleteAssignment, saveAssignment } from "../actions";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("closingAssignments");

const DUE_TONE: Record<DueState, string> = {
  overdue: "bg-destructive text-white",
  today: "bg-amber-500 text-black",
  soon: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  later: "bg-muted",
  done: "bg-emerald-700 text-white",
  none: "bg-muted text-muted-foreground",
};

type Row = {
  id: string;
  applicationId: string;
  title: string;
  description: string | null;
  link: string | null;
  receivedAt: Date | null;
  dueAt: Date | null;
  estimatedHours: number | null;
  status: string;
  submittedLink: string | null;
  notes: string | null;
};

/** מטלות בית (#111): per-application take-home tasks with due-date reminders. */
export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string; edit?: string; error?: string }>;
}) {
  const user = await requireUser("/closing/assignments");
  const [{ locale }, sp] = await Promise.all([getDictionary(), searchParams]);
  const s = closingStrings[locale];
  const now = new Date();

  const [rows, apps] = await Promise.all([
    db.homeAssignment.findMany({
      where: { userId: user.id, application: { archivedAt: null }, ...(sp.app ? { applicationId: sp.app } : {}) },
      select: {
        id: true,
        applicationId: true,
        title: true,
        description: true,
        link: true,
        receivedAt: true,
        dueAt: true,
        estimatedHours: true,
        status: true,
        submittedLink: true,
        notes: true,
        application: { select: { title: true, company: true } },
      },
      take: 200,
    }),
    db.application.findMany({
      where: { userId: user.id, archivedAt: null, status: { notIn: ["REJECTED"] } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, company: true },
      take: 100,
    }),
  ]);
  const sorted = sortByDue(rows);
  const editing = sp.edit ? sorted.find((r) => r.id === sp.edit) : undefined;
  const filterApp = sp.app ? apps.find((a) => a.id === sp.app) : undefined;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader kicker={s.kicker} title={s.aTitle} lead={s.aLead} noAuto={s.noAuto} testId="assignments-no-auto">
        <Link href="/closing" className="mt-3 inline-block text-sm underline underline-offset-2">
          {s.back}
        </Link>
      </PageHeader>

      {filterApp && (
        <p className="text-sm">
          <bdi className="font-medium">
            {filterApp.title} · {filterApp.company}
          </bdi>{" "}
          ·{" "}
          <Link href="/closing/assignments" className="underline underline-offset-2">
            {s.aTitle}
          </Link>
        </p>
      )}

      <section aria-label={s.aTitle} data-testid="assignments-list">
        {sorted.length === 0 ? (
          <p className="text-muted-foreground text-sm">{s.aEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sorted.map((a) => {
              const st = dueState(a, now);
              return (
                <li
                  key={a.id}
                  className="bg-card flex flex-col gap-1 rounded-lg border p-3"
                  data-testid="assignment-row"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        <bdi>{a.title}</bdi>
                      </p>
                      <p className="text-muted-foreground text-xs">
                        <bdi>
                          {a.application.title} · {a.application.company}
                        </bdi>
                      </p>
                    </div>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs", DUE_TONE[st])} data-testid="assignment-due">
                      {s[`aDue_${st}`]}
                    </span>
                  </div>
                  <p className="text-sm">
                    {s.aStatuses[a.status as keyof ClosingStrings["aStatuses"]] ?? a.status}
                    {a.dueAt && ` · ${s.aDue} ${fmtWhen(a.dueAt, locale)}`}
                    {a.estimatedHours != null && ` · ${fillC(s.aHoursValue, { n: a.estimatedHours })}`}
                  </p>
                  {a.description && (
                    <p dir="auto" className="text-muted-foreground text-sm whitespace-pre-line">
                      {a.description}
                    </p>
                  )}
                  {a.notes && (
                    <p dir="auto" className="text-sm whitespace-pre-line">
                      {a.notes}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {a.link && (
                      <a
                        href={a.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 underline"
                      >
                        {s.aOpenLink}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    )}
                    {a.submittedLink && (
                      <a
                        href={a.submittedLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 underline"
                      >
                        {s.aOpenSubmitted}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    )}
                    <Link
                      href={`/closing/assignments?edit=${a.id}${sp.app ? `&app=${sp.app}` : ""}#assignment-form`}
                      className="underline"
                    >
                      {s.edit}
                    </Link>
                    <form action={deleteAssignment}>
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className="text-destructive underline" data-testid="assignment-delete">
                        {s.remove}
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section
        id="assignment-form"
        className="bg-card flex flex-col gap-3 rounded-lg border p-4"
        aria-labelledby="assignment-form-title"
      >
        <h2 id="assignment-form-title" className="font-heading text-lg font-bold">
          {editing ? `${s.edit}: ${editing.title}` : s.aAdd}
        </h2>
        {sp.error && (
          <p className="text-destructive text-sm" role="alert">
            {s.error}
          </p>
        )}
        {apps.length === 0 ? (
          <p className="text-muted-foreground text-sm">{s.aNoApps}</p>
        ) : (
          <AssignmentForm key={editing?.id ?? "new"} s={s} apps={apps} row={editing} defaultApp={sp.app} />
        )}
      </section>
    </div>
  );
}

function AssignmentForm({
  s,
  apps,
  row,
  defaultApp,
}: {
  s: ClosingStrings;
  apps: { id: string; title: string; company: string }[];
  row?: Row;
  defaultApp?: string;
}) {
  return (
    <form action={saveAssignment} className="grid gap-3 sm:grid-cols-2" data-testid="assignment-form">
      {row && <input type="hidden" name="id" value={row.id} />}
      {defaultApp && <input type="hidden" name="back" value="app" />}
      <label className={cn(fieldCls, "sm:col-span-2")}>
        <span>{s.aApp}</span>
        <select
          name="applicationId"
          required
          defaultValue={row?.applicationId ?? defaultApp ?? ""}
          className={selectCls}
          data-testid="assignment-app"
        >
          <option value="" disabled>
            {s.aPickApp}
          </option>
          {apps.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title} · {a.company}
            </option>
          ))}
        </select>
      </label>
      <label className={cn(fieldCls, "sm:col-span-2")}>
        <span>{s.aTitleField}</span>
        <Input
          name="title"
          required
          maxLength={160}
          dir="auto"
          defaultValue={row?.title ?? ""}
          data-testid="assignment-title"
        />
      </label>
      <label className={cn(fieldCls, "sm:col-span-2")}>
        <span>{s.aDescription}</span>
        <textarea
          name="description"
          rows={3}
          maxLength={4000}
          dir="auto"
          defaultValue={row?.description ?? ""}
          className="bg-background w-full rounded-md border p-2 text-sm"
        />
      </label>
      <label className={fieldCls}>
        <span>{s.aLink}</span>
        <Input name="link" type="url" maxLength={500} dir="ltr" defaultValue={row?.link ?? ""} />
      </label>
      <label className={fieldCls}>
        <span>{s.aStatus}</span>
        <select
          name="status"
          defaultValue={row?.status ?? "TODO"}
          className={selectCls}
          data-testid="assignment-status"
        >
          {ASSIGNMENT_STATUSES.map((st) => (
            <option key={st} value={st}>
              {s.aStatuses[st]}
            </option>
          ))}
        </select>
      </label>
      <label className={fieldCls}>
        <span>{s.aReceived}</span>
        <Input name="receivedAt" type="date" defaultValue={dateToIsraelLocal(row?.receivedAt).slice(0, 10)} />
      </label>
      <label className={fieldCls}>
        <span>{s.aDue}</span>
        <Input
          name="dueAt"
          type="datetime-local"
          defaultValue={dateToIsraelLocal(row?.dueAt)}
          data-testid="assignment-due-input"
        />
      </label>
      <label className={fieldCls}>
        <span>{s.aHours}</span>
        <Input name="estimatedHours" type="number" min={0} max={200} defaultValue={row?.estimatedHours ?? ""} />
      </label>
      <label className={fieldCls}>
        <span>{s.aSubmittedLink}</span>
        <Input name="submittedLink" type="url" maxLength={500} dir="ltr" defaultValue={row?.submittedLink ?? ""} />
      </label>
      <label className={cn(fieldCls, "sm:col-span-2")}>
        <span>{s.aNotes}</span>
        <textarea
          name="notes"
          rows={2}
          maxLength={2000}
          dir="auto"
          defaultValue={row?.notes ?? ""}
          className="bg-background w-full rounded-md border p-2 text-sm"
        />
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" data-testid="assignment-save">
          {s.save}
        </Button>
        {row && (
          <Button asChild variant="ghost">
            <Link href="/closing/assignments">{s.cancel}</Link>
          </Button>
        )}
      </div>
    </form>
  );
}
