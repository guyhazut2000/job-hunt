import { BarChart3, MailCheck, MapPinned, Plus } from "lucide-react";
import Link from "next/link";
import { addManualApplication } from "@/app/actions";
import { AutoChangesPanel, type AutoLabels } from "@/components/email/AutoChanges";
import { ReviewQueue } from "@/components/email/ReviewQueue";
import { Kanban } from "@/components/Kanban";
import { ContactList } from "@/components/outreach/ContactList";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getStatusHistory } from "@/lib/email/history";
import { getReviewItems } from "@/lib/email/review";
import { getDictionary } from "@/lib/i18n";
import { cvTailorStrings } from "@/lib/i18n/cv-tailor";
import { interviewStrings } from "@/lib/i18n/interview";
import { emailSyncStrings } from "@/lib/i18n/email-sync";
import { jobsMapStrings } from "@/lib/i18n/jobs-map";
import { reminderStrings } from "@/lib/i18n/reminders";
import { statsStrings } from "@/lib/i18n/stats";
import { formatInterviewTime } from "@/lib/notifications/interviews";
import { toIsraelLocalInput } from "@/lib/notifications/israel-time";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const { t, locale } = await getDictionary();
  const es = emailSyncStrings[locale];
  const ss = statsStrings(locale);
  const ms = jobsMapStrings(locale);
  const [apps, contacts, review] = await Promise.all([
    db.application.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        company: true,
        url: true,
        jobId: true,
        status: true,
        interviewAt: true,
        interviewNote: true,
      },
    }),
    db.contact.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        job: { select: { id: true, title: true } },
        company: { select: { name: true, slug: true } },
      },
    }),
    getReviewItems(user.id, locale),
  ]);
  const byJob = new Map<string, { total: number; referred: number }>();
  for (const c of contacts) {
    if (!c.jobId) continue;
    const e = byJob.get(c.jobId) ?? { total: 0, referred: 0 };
    e.total++;
    if (c.status === "REFERRED") e.referred++;
    byJob.set(c.jobId, e);
  }
  const history = await getStatusHistory(user.id, apps, locale);
  const autoLabels: AutoLabels = {
    badge: es.autoBadge,
    undo: es.undo,
    undone: es.undone,
    undoConflict: es.undoConflict,
    undoAria: es.undoAria,
    timeline: es.timeline,
    created: es.created,
    autoCreated: es.autoCreated,
    autoMoved: es.autoMoved,
    source: es.source,
    followUpSent: es.followUpSent,
  };
  const items = apps.map(({ interviewAt, interviewNote, ...a }) => ({
    ...a,
    history: history.timeline.get(a.id),
    auto: history.auto.get(a.id) ?? null,
    contacts: a.jobId ? byJob.get(a.jobId) : undefined,
    interview: interviewAt
      ? {
          value: toIsraelLocalInput(interviewAt),
          display: formatInterviewTime(interviewAt, locale),
          note: interviewNote,
        }
      : null,
  }));
  const rs = reminderStrings(locale);
  const contactRows = contacts.map((c) => ({
    id: c.id,
    name: c.name,
    title: c.title,
    linkedinUrl: c.linkedinUrl,
    category: c.category,
    status: c.status,
    notes: c.notes,
    context: c.job
      ? { label: `${c.job.title} · ${c.company?.name ?? ""}`, href: `/jobs/${c.job.id}` }
      : c.company
        ? { label: c.company.name, href: `/companies/${c.company.slug}` }
        : null,
  }));
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

      <Link
        href="/stats"
        data-testid="dashboard-stats-link"
        className="bg-card hover:bg-muted/60 flex min-h-12 items-center gap-3 rounded-lg border px-4 py-2 transition-colors"
      >
        <BarChart3 className="text-primary size-5 shrink-0" aria-hidden />
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold">{ss.dashboardLink}</span>
          <span className="text-muted-foreground truncate text-xs">{ss.dashboardHint}</span>
        </span>
      </Link>
      <Link
        href="/settings/email"
        className="bg-card hover:bg-muted/60 flex min-h-12 items-center gap-3 rounded-lg border px-4 py-2 transition-colors"
      >
        <MailCheck className="text-primary size-5 shrink-0" aria-hidden />
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold">{es.emailSettings}</span>
          <span className="text-muted-foreground truncate text-xs">{es.emailSettingsHint}</span>
        </span>
        {review.length > 0 && (
          <span className="bg-caution-soft text-caution ms-auto rounded-full px-2 py-0.5 font-mono text-xs font-bold">
            {review.length}
          </span>
        )}
      </Link>
      <Link
        href="/settings/places"
        className="bg-card hover:bg-muted/60 flex min-h-12 items-center gap-3 rounded-lg border px-4 py-2 transition-colors"
      >
        <MapPinned className="text-primary size-5 shrink-0" aria-hidden />
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold">{ms.placesTitle}</span>
          <span className="text-muted-foreground truncate text-xs">{ms.setPlaceHint}</span>
        </span>
      </Link>

      {history.recent.length > 0 && (
        <AutoChangesPanel
          items={history.recent}
          labels={autoLabels}
          statusLabels={t.status}
          title={es.autoTitle}
          lead={es.autoLead}
          confidenceLabel={es.confidenceLabel}
        />
      )}

      {review.length > 0 && (
        <section aria-labelledby="email-review-h" className="flex flex-col gap-3">
          <div>
            <h2 id="email-review-h" className="font-heading text-xl font-bold">
              {es.reviewTitle} <span className="text-caution font-mono text-base">({review.length})</span>
            </h2>
            <p className="text-muted-foreground text-sm">{es.reviewLead}</p>
          </div>
          <ReviewQueue items={review} s={es} statusLabels={t.status} />
        </section>
      )}

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
        autoLabels={autoLabels}
        contactsLabel={{ count: t.people.trackerCount, referred: t.people.trackerReferred }}
        prepLabels={{ cv: cvTailorStrings(locale).appCta, interview: interviewStrings(locale).practiceCta }}
        interviewLabels={{
          set: rs.interviewSet,
          date: rs.interviewDate,
          note: rs.interviewNote,
          save: rs.interviewSave,
          clear: rs.interviewClear,
          saved: rs.interviewSaved,
          invalid: rs.interviewInvalid,
          at: rs.interviewAt,
        }}
      />

      <section aria-labelledby="outreach-h" className="border-rule flex flex-col gap-3 border-t-2 pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="outreach-h" className="font-heading text-xl font-bold">
            {t.people.outreach}
          </h2>
          {contacts.length > 0 && (
            <p className="text-muted-foreground text-sm">
              {t.people.trackerCount.replace("{n}", String(contacts.length))}
              {" · "}
              <span className="text-fit font-semibold">
                {contacts.filter((c) => c.status === "REFERRED").length} {t.people.trackerReferred}
              </span>
            </p>
          )}
        </div>
        {contacts.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">{t.people.outreachEmpty}</p>
        ) : (
          <ContactList contacts={contactRows} t={t.people} />
        )}
      </section>
    </div>
  );
}
