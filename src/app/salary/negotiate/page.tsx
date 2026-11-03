import { ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { salaryHubStrings } from "@/lib/i18n/salary-hub";
import { localizedTitle } from "@/lib/i18n/titles";
import { offerInputSchema } from "@/lib/offers/calc";
import { CopyButton } from "@/components/outreach/CopyButton";
import { CounterOfferDrafter, type CounterPrefill } from "@/components/salary-hub/CounterOfferDrafter";
import { NegotiationChecklist } from "@/components/salary-hub/NegotiationChecklist";
import { SalaryHeader } from "@/components/salary-hub/SalaryTabs";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("salaryNegotiate");

/** Negotiation prep (#91): checklist, scripts, counter-offer draft. Never sends anything. */
export default async function NegotiatePage() {
  const [{ locale }, session] = await Promise.all([getDictionary(), auth()]);
  const s = salaryHubStrings[locale];
  const n = s.negotiate;
  const userId = session?.user?.id;
  const [offers, apps] = userId
    ? await Promise.all([
        db.jobOffer.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          take: 10,
          include: { application: { select: { title: true, askedSalaryMonthly: true } } },
        }),
        db.application.findMany({
          where: { userId, askedSalaryMonthly: { not: null }, status: { in: ["SCREENING", "INTERVIEW", "OFFER"] } },
          orderBy: { updatedAt: "desc" },
          select: { id: true, title: true, company: true, askedSalaryMonthly: true },
          take: 10,
        }),
      ])
    : [[], []];
  const prefills: CounterPrefill[] = [
    ...offers.map((o) => {
      const d = offerInputSchema.parse(o.data);
      return {
        id: `o:${o.id}`,
        label: o.label,
        company: d.company,
        role: o.application?.title ?? "",
        offered: d.baseMonthly,
        ask: o.application?.askedSalaryMonthly ?? 0,
      };
    }),
    ...apps.map((a) => ({
      id: `a:${a.id}`,
      label: `${a.title} · ${a.company}`,
      company: a.company,
      role: a.title,
      offered: 0,
      ask: a.askedSalaryMonthly ?? 0,
    })),
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <SalaryHeader s={s} active="negotiate" title={n.title} lead={n.lead} />
      <p
        className="flex items-start gap-2 rounded-md border border-emerald-600/30 bg-emerald-600/5 p-3 text-sm"
        data-testid="negotiate-no-auto"
      >
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden />
        <span>{n.noAuto}</span>
      </p>

      <section aria-labelledby="check-h" className="bg-card rounded-lg border p-4">
        <h2 id="check-h" className="font-heading text-xl font-bold">
          {n.checklistTitle}
        </h2>
        <div className="mt-2">
          <NegotiationChecklist items={n.checklist} savedLabel={n.checklistSaved} />
        </div>
      </section>

      <section aria-labelledby="scripts-h" className="flex flex-col gap-3" data-testid="negotiate-scripts">
        <div>
          <h2 id="scripts-h" className="font-heading text-xl font-bold">
            {n.scriptsTitle}
          </h2>
          <p className="text-muted-foreground text-sm">{n.scriptsLead}</p>
        </div>
        {n.scripts.map((sc) => (
          <article key={sc.when} className="bg-card flex flex-col gap-2 rounded-lg border p-4">
            <h3 className="text-sm font-bold">{sc.when}</h3>
            <p className="text-sm leading-relaxed" dir="auto">
              {sc.text}
            </p>
            <div>
              <CopyButton text={sc.text} label={n.copy} copiedLabel={n.copied} />
            </div>
          </article>
        ))}
      </section>

      <section aria-labelledby="counter-h" className="bg-card flex flex-col gap-3 rounded-lg border p-4">
        <div>
          <h2 id="counter-h" className="font-heading text-xl font-bold">
            {n.counterTitle}
          </h2>
          <p className="text-muted-foreground text-sm">{n.counterLead}</p>
        </div>
        <CounterOfferDrafter s={n} locale={locale} name={session?.user?.name ?? ""} prefills={prefills} />
      </section>
    </div>
  );
}
