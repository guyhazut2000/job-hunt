import { ExternalLink } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { fill, salaryHubStrings } from "@/lib/i18n/salary-hub";
import { localizedTitle } from "@/lib/i18n/titles";
import { offerInputSchema } from "@/lib/offers/calc";
import { DEFAULT_CREDIT_POINTS, TAX_SOURCES } from "@/lib/offers/tax";
import { OfferComparison, type OfferDraft } from "@/components/salary-hub/OfferComparison";
import { SalaryHeader } from "@/components/salary-hub/SalaryTabs";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("salaryOffers");

/** Offer comparison calculator (#91, docs/offers.md). Works signed out; saving needs an account. */
export default async function OffersPage() {
  const [{ locale }, session] = await Promise.all([getDictionary(), auth()]);
  const s = salaryHubStrings[locale];
  const userId = session?.user?.id;
  const [rows, apps] = userId
    ? await Promise.all([
        db.jobOffer.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 3 }),
        db.application.findMany({
          where: { userId, status: { not: "REJECTED" } },
          orderBy: { updatedAt: "desc" },
          select: { id: true, title: true, company: true },
          take: 60,
        }),
      ])
    : [[], []];
  const initial: OfferDraft[] = rows.map((r) => ({
    key: r.id,
    id: r.id,
    applicationId: r.applicationId,
    data: offerInputSchema.parse({ ...(r.data as object), label: (r.data as { label?: string })?.label || r.label }),
  }));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <SalaryHeader s={s} active="offers" title={s.offers.title} lead={s.offers.lead} />
      <div className="border-caution/40 bg-caution/5 rounded-md border p-3 text-sm" data-testid="offers-estimate">
        <p className="font-bold">{s.offers.estimate}</p>
        <p className="text-muted-foreground mt-1">{fill(s.offers.estimateNote, { points: DEFAULT_CREDIT_POINTS })}</p>
      </div>
      <OfferComparison
        initial={initial}
        apps={apps.map((a) => ({ id: a.id, label: `${a.title} · ${a.company}` }))}
        signedIn={!!userId}
        s={s.offers}
        locale={locale}
      />
      <section className="text-sm" data-testid="offers-tax-sources">
        <h2 className="font-bold">{s.offers.sources}</h2>
        <ul className="mt-1 flex flex-col gap-1">
          {TAX_SOURCES.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-2">
              <a
                href={t.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-4"
              >
                {locale === "he" ? t.nameHe : t.name}
                <ExternalLink className="size-3 shrink-0" aria-hidden />
              </a>
              <span className="text-muted-foreground text-xs">
                {fill(s.published, { date: t.effective })} · {fill(s.checked, { date: t.checked })}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
