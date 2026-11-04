import { densityStrings } from "@/lib/i18n/density";
import { ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { referralStrings } from "@/lib/i18n/referrals";
import { localizedTitle } from "@/lib/i18n/titles";
import { referralFollowUpDue } from "@/lib/referrals/followup";
import { requireUser } from "@/lib/session";
import { AddContactForm, CsvImport } from "@/components/referrals/AddContact";
import { InsiderContacts } from "@/components/referrals/InsiderContacts";
import { ReferralTracker } from "@/components/referrals/ReferralTracker";
import type { ContactRow, ReferralRow, TargetOption } from "@/components/referrals/types";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("referrals");

/** חבר מביא חבר (#92, docs/referrals.md): insider contacts, copy-only requests, tracker. Never sends. */
export default async function ReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string; job?: string; app?: string }>;
}) {
  const user = await requireUser("/referrals");
  const [{ locale }, sp] = await Promise.all([getDictionary(), searchParams]);
  const s = referralStrings[locale];
  const now = new Date();

  const [contacts, referrals, apps] = await Promise.all([
    db.contact.findMany({
      where: { userId: user.id, insider: true },
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        title: true,
        companyId: true,
        companyName: true,
        email: true,
        linkedinUrl: true,
        relationship: true,
        notes: true,
        company: { select: { name: true, slug: true } },
      },
      take: 500,
    }),
    db.referral.findMany({
      where: { userId: user.id },
      orderBy: [{ statusAt: "desc" }],
      select: {
        id: true,
        contactId: true,
        status: true,
        statusAt: true,
        followedUpAt: true,
        outcome: true,
        note: true,
        applicationId: true,
        contact: { select: { name: true, companyName: true, company: { select: { name: true } } } },
        application: { select: { title: true, company: true } },
        job: { select: { title: true } },
      },
      take: 200,
    }),
    db.application.findMany({
      where: { userId: user.id, status: { not: "REJECTED" } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, company: true, job: { select: { companyId: true } } },
      take: 100,
    }),
  ]);

  const companyIds = [...new Set(contacts.map((c) => c.companyId).filter((x): x is string => !!x))];
  const [jobs, catalog] = await Promise.all([
    companyIds.length
      ? db.job.findMany({
          where: { companyId: { in: companyIds }, isActive: true },
          orderBy: { postedAt: "desc" },
          select: { id: true, title: true, companyId: true, company: { select: { name: true } } },
          take: 200,
        })
      : Promise.resolve([]),
    db.company.findMany({ select: { name: true }, orderBy: { name: "asc" }, take: 400 }),
  ]);
  // A deep link to a specific job (from a job card) must be selectable even if it's not in the top 200.
  const deepJob =
    sp.job && !jobs.some((j) => j.id === sp.job)
      ? await db.job.findUnique({
          where: { id: sp.job },
          select: { id: true, title: true, companyId: true, company: { select: { name: true } } },
        })
      : null;

  const contactRows: ContactRow[] = contacts.map((c) => ({
    id: c.id,
    name: c.name,
    title: c.title,
    companyId: c.companyId,
    companyName: c.companyName ?? c.company?.name ?? "",
    companySlug: c.company?.slug ?? null,
    email: c.email,
    linkedinUrl: c.linkedinUrl,
    relationship: c.relationship,
    notes: c.notes,
  }));
  const targets: TargetOption[] = [
    ...apps.map((a) => ({
      value: `a:${a.id}`,
      label: `${a.title} · ${a.company}`,
      companyId: a.job?.companyId ?? null,
      companyName: a.company,
    })),
    ...[...jobs, ...(deepJob ? [deepJob] : [])].map((j) => ({
      value: `j:${j.id}`,
      label: `${j.title} · ${j.company.name}`,
      companyId: j.companyId,
      companyName: j.company.name,
    })),
  ];
  const rows: ReferralRow[] = referrals.map((r) => ({
    id: r.id,
    contactId: r.contactId,
    contactName: r.contact.name,
    company: r.application?.company ?? r.contact.company?.name ?? r.contact.companyName ?? "",
    status: r.status,
    statusAt: r.statusAt.toISOString(),
    outcome: r.outcome,
    note: r.note,
    applicationId: r.applicationId,
    jobTitle: r.application?.title ?? r.job?.title ?? null,
    due: referralFollowUpDue(r, now),
  }));
  const stats = {
    asked: rows.length,
    submitted: rows.filter((r) => r.status === "SUBMITTED" || r.status === "ANSWERED").length,
    positive: rows.filter((r) => r.outcome === "positive").length,
  };
  const initialTarget = sp.app ? `a:${sp.app}` : sp.job ? `j:${sp.job}` : null;
  const contactParam = sp.contact && contactRows.some((c) => c.id === sp.contact) ? sp.contact : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="rule-double pb-4">
        <p className="kicker">{s.kicker}</p>
        <h1 className="text-title mt-1 font-black">{s.title}</h1>
        <p className="text-muted-foreground mt-2">{s.lead}</p>
        <p
          className="mt-3 flex items-start gap-2 rounded-md border border-emerald-600/30 bg-emerald-600/5 p-3 text-sm"
          data-testid="referrals-no-auto"
        >
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden />
          <span>{s.noAuto}</span>
        </p>
      </header>

      <section className="flex flex-col gap-3" aria-labelledby="ref-tracker">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="ref-tracker" className="font-heading text-lg font-bold">
            {s.trackerTitle}
          </h2>
          {rows.length > 0 && (
            <p className="text-muted-foreground text-sm" data-testid="referral-stats">
              {s.statsAsked}: {stats.asked} · {s.statsSubmitted}: {stats.submitted} · {s.statsPositive}:{" "}
              {stats.positive}
            </p>
          )}
        </div>
        <ReferralTracker
          s={s}
          rows={rows}
          apps={apps.map((a) => ({ id: a.id, label: `${a.title} · ${a.company}` }))}
          now={now.toISOString()}
          d={densityStrings(locale)}
        />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="ref-contacts">
        <h2 id="ref-contacts" className="font-heading text-lg font-bold">
          {s.contactsTitle}{" "}
          {contactRows.length > 0 && <span className="text-muted-foreground">({contactRows.length})</span>}
        </h2>
        <p className="text-muted-foreground -mt-2 text-sm">{s.contactsLead}</p>
        <InsiderContacts
          s={s}
          contacts={contactRows}
          targets={targets}
          locale={locale}
          initial={{ contactId: contactParam, target: initialTarget }}
          d={densityStrings(locale)}
        />
      </section>

      <section className="bg-card flex flex-col gap-3 rounded-lg border p-4" aria-labelledby="ref-add">
        <h2 id="ref-add" className="font-heading text-lg font-bold">
          {s.addTitle}
        </h2>
        <AddContactForm s={s} companies={catalog.map((c) => c.name)} />
      </section>

      <section className="bg-card flex flex-col gap-3 rounded-lg border p-4" aria-labelledby="ref-import">
        <h2 id="ref-import" className="font-heading text-lg font-bold">
          {s.importTitle}
        </h2>
        <CsvImport s={s} />
      </section>
    </div>
  );
}
