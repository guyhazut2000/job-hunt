import Link from "next/link";
import { Archive, ArrowLeft, ClipboardCheck, FileSignature, UserCheck } from "lucide-react";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { closingStrings, fillC } from "@/lib/i18n/closing";
import { localizedTitle } from "@/lib/i18n/titles";
import { checklistProgress, parseChecklist } from "@/lib/closing/checklist";
import { dueState, sortByDue } from "@/lib/closing/assignments";
import { needsBrief } from "@/lib/closing/referees";
import { requireUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Disclaimer, PageHeader, fmtWhen } from "@/components/closing/ui";
import { startClosingFromApp } from "./actions";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("closing");

/** השלב הסופי (#111, docs/closing.md): offers → contract checklist & transition, assignments, references. */
export default async function ClosingHubPage({ searchParams }: { searchParams: Promise<{ limit?: string }> }) {
  const user = await requireUser("/closing");
  const [{ locale }, sp] = await Promise.all([getDictionary(), searchParams]);
  const s = closingStrings[locale];
  const now = new Date();

  const [offers, offerApps, assignments, referees, archived] = await Promise.all([
    db.jobOffer.findMany({
      where: { userId: user.id },
      orderBy: [{ acceptedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
      select: {
        id: true,
        label: true,
        acceptedAt: true,
        application: { select: { title: true, company: true } },
        closing: { select: { checklist: true } },
      },
      take: 20,
    }),
    db.application.findMany({
      where: { userId: user.id, status: "OFFER", archivedAt: null, offers: { none: {} } },
      select: { id: true, title: true, company: true },
      take: 20,
    }),
    db.homeAssignment.findMany({
      where: { userId: user.id, application: { archivedAt: null } },
      select: { id: true, dueAt: true, status: true, title: true },
      take: 200,
    }),
    db.referee.findMany({
      where: { userId: user.id },
      select: { consent: true, links: { select: { expectedCallAt: true, briefedAt: true } } },
      take: 100,
    }),
    db.application.count({ where: { userId: user.id, archivedAt: { not: null } } }),
  ]);

  const open = sortByDue(assignments.filter((a) => a.status === "TODO" || a.status === "IN_PROGRESS"));
  const next = open.find((a) => a.dueAt);
  const overdue = open.filter((a) => dueState(a, now) === "overdue").length;
  const agreed = referees.filter((r) => r.consent === "AGREED").length;
  const briefs = referees.flatMap((r) => r.links).filter((l) => needsBrief(l, now)).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader kicker={s.kicker} title={s.title} lead={s.lead} noAuto={s.noAuto} testId="closing-no-auto" />

      <section className="flex flex-col gap-3" aria-labelledby="closing-offers" data-testid="closing-offers">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="closing-offers" className="font-heading flex items-center gap-2 text-lg font-bold">
            <FileSignature className="size-5" aria-hidden />
            {s.offersTitle}
          </h2>
          <Link href="/salary/offers" className="text-sm underline underline-offset-2">
            {s.compareOffers}
          </Link>
        </div>
        {sp.limit && (
          <p className="text-destructive text-sm" role="alert">
            {s.offerLimit}
          </p>
        )}
        {offers.length === 0 && offerApps.length === 0 && (
          <p className="text-muted-foreground text-sm">{s.offersEmpty}</p>
        )}
        <ul className="flex flex-col gap-2">
          {offers.map((o) => {
            const p = checklistProgress(parseChecklist(o.closing?.checklist));
            const name = o.application ? `${o.application.title} · ${o.application.company}` : o.label;
            return (
              <li
                key={o.id}
                className="bg-card flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    <bdi>{name}</bdi>
                    {o.acceptedAt && (
                      <span className="ms-2 rounded-full bg-emerald-700 px-2 py-0.5 text-xs text-white">
                        {s.acceptedBadge}
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {fillC(s.checklistProgress, { done: p.done, total: p.total })}
                    {p.concern > 0 && ` · ${fillC(s.concerns, { n: p.concern })}`}
                  </p>
                </div>
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/closing/${o.id}`} data-testid="closing-open-offer">
                    {s.openOffer}
                    <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
                  </Link>
                </Button>
              </li>
            );
          })}
          {offerApps.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3"
            >
              <p className="min-w-0 font-medium">
                <bdi>
                  {a.title} · {a.company}
                </bdi>
              </p>
              <form action={startClosingFromApp}>
                <input type="hidden" name="applicationId" value={a.id} />
                <Button type="submit" size="sm" data-testid="closing-start">
                  {s.startFromApp}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/closing/assignments"
          className="bg-card hover:bg-muted/40 flex flex-col gap-1 rounded-lg border p-4"
          data-testid="closing-card-assignments"
        >
          <span className="font-heading flex items-center gap-2 font-bold">
            <ClipboardCheck className="size-5" aria-hidden />
            {s.assignmentsTitle}
          </span>
          <span className="text-muted-foreground text-sm">{s.assignmentsLead}</span>
          <span className="text-sm">
            {fillC(s.assignmentsSummary, { open: open.length })}
            {overdue > 0 && (
              <span className="text-destructive">
                {" "}
                · {s.aDue_overdue}: {overdue}
              </span>
            )}
          </span>
          {next?.dueAt && (
            <span className="text-xs">
              {fillC(s.nextDue, { when: fmtWhen(next.dueAt, locale) })} · <bdi>{next.title}</bdi>
            </span>
          )}
        </Link>
        <Link
          href="/closing/references"
          className="bg-card hover:bg-muted/40 flex flex-col gap-1 rounded-lg border p-4"
          data-testid="closing-card-references"
        >
          <span className="font-heading flex items-center gap-2 font-bold">
            <UserCheck className="size-5" aria-hidden />
            {s.referencesTitle}
          </span>
          <span className="text-muted-foreground text-sm">{s.referencesLead}</span>
          <span className="text-sm">{fillC(s.referencesSummary, { n: referees.length, agreed })}</span>
          {briefs > 0 && <span className="text-xs text-amber-700">{fillC(s.briefDue, { n: briefs })}</span>}
        </Link>
      </div>

      {archived > 0 && (
        <section
          className="bg-muted/30 flex items-start gap-2 rounded-lg border p-3 text-sm"
          data-testid="closing-archived"
        >
          <Archive className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">{s.archivedTitle}</p>
            <p className="text-muted-foreground">{fillC(s.archivedLead, { n: archived })}</p>
          </div>
        </section>
      )}

      <Disclaimer text={s.disclaimer} />
    </div>
  );
}
