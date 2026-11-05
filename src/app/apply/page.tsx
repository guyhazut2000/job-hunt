import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ShowMoreList } from "@/components/density/ShowMoreList";
import { Badge } from "@/components/ui/badge";
import { getLocale } from "@/lib/i18n";
import { autoApplyStrings } from "@/lib/i18n/auto-apply";
import { densityStrings } from "@/lib/i18n/density";
import { localizedTitle } from "@/lib/i18n/titles";
import { groupQueue } from "@/lib/auto-apply/queue";
import { listQueue } from "@/lib/auto-apply/server";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("applyQueue");

export default async function ApplyQueuePage() {
  const user = await requireUser("/apply");
  const locale = await getLocale();
  const s = autoApplyStrings(locale);
  const ds = densityStrings(locale);
  const grouped = groupQueue(await listQueue(user.id));
  const sections = [
    { id: "review", title: s.review, empty: s.emptyReview, rows: grouped.review },
    { id: "manual", title: s.manual, empty: s.emptyManual, rows: grouped.manual },
    { id: "done", title: s.done, empty: s.emptyDone, rows: grouped.done },
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="rule-double flex flex-col gap-2 pb-4">
        <p className="kicker">{s.kicker}</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-title font-black">{s.queueTitle}</h1>
          <Link href="/apply/settings" className="text-primary text-sm font-semibold underline">
            {s.settingsLink}
          </Link>
        </div>
        <p className="text-muted-foreground max-w-prose leading-relaxed">{s.queueLead}</p>
      </header>
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`${section.id}-h`} className="flex flex-col gap-3">
          <h2 id={`${section.id}-h`} className="font-heading text-lg font-bold">
            {section.title} <span className="text-muted-foreground font-mono text-base">({section.rows.length})</span>
          </h2>
          {section.rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">{section.empty}</p>
          ) : (
            <ShowMoreList initial={8} step={16} className="flex flex-col gap-2" s={ds} testId={`apply-${section.id}`}>
              {section.rows.map((row) => (
                <li key={row.id} className="bg-card flex flex-col gap-1 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/jobs/${row.job.id}/apply`} className="font-semibold hover:underline">
                      {row.job.title}
                    </Link>
                    <Badge variant="outline">{s.status[row.status]}</Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">{row.job.company.name}</p>
                  <a
                    href={row.job.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold underline"
                  >
                    {s.openForm}
                    <ExternalLink className="size-4" aria-hidden />
                  </a>
                </li>
              ))}
            </ShowMoreList>
          )}
        </section>
      ))}
    </div>
  );
}
