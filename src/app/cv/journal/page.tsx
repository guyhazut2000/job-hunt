import { NotebookPen } from "lucide-react";
import { WorkJournal } from "@/components/journal/WorkJournal";
import { targetJobs } from "@/lib/cv-assist/server";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { journalStrings } from "@/lib/i18n/journal";
import { localizedTitle } from "@/lib/i18n/titles";
import { israelDayOf } from "@/lib/journal/core";
import { journalRoles, listEntries } from "@/lib/journal/server";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("cvJournal");

/** Work journal (docs/work-journal.md): what you did at work → achievements → CV experience bullets. */
export default async function WorkJournalPage() {
  const user = await requireUser("/cv/journal");
  const locale = await getLocale();
  const s = journalStrings(locale);
  const [{ roles, current }, entries, settings, jobs] = await Promise.all([
    journalRoles(user.id),
    listEntries(user.id),
    db.workJournalSettings.findUnique({ where: { userId: user.id } }),
    targetJobs(user.id),
  ]);
  const today = israelDayOf();
  return (
    <div className="flex flex-col gap-6" data-testid="journal-page">
      <header className="rule-double flex flex-col gap-2 pb-4">
        <h1 className="font-heading text-title flex items-center gap-2 font-black">
          <NotebookPen className="text-primary size-7 shrink-0" aria-hidden />
          {s.title}
        </h1>
        <p className="text-muted-foreground max-w-3xl leading-relaxed">{s.intro}</p>
      </header>
      <WorkJournal
        locale={locale === "en" ? "en" : "he"}
        today={today}
        roles={roles.map((r) => ({ key: r.key, label: r.label, current: !r.end }))}
        defaultRole={current}
        entries={entries}
        jobs={jobs.map((j) => ({ id: j.id, label: `${j.title} · ${j.company}` }))}
        settings={{
          reminderOn: settings?.reminderOn ?? false,
          frequency: settings?.frequency === "daily" ? "daily" : "weekly",
          weekday: settings?.weekday ?? 4,
          hour: settings?.hour ?? 17,
        }}
      />
    </div>
  );
}
