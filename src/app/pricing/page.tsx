import { startCheckout } from "@/app/actions";
import { auth } from "@/auth";
import { billingEnabled, PLANS } from "@/lib/billing";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pricing" };

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ billing?: string }> }) {
  const [{ t }, session, sp] = await Promise.all([getDictionary(), auth(), searchParams]);
  const plan = session?.user?.id ? (await db.user.findUnique({ where: { id: session.user.id } }))?.plan : undefined;
  const showDisabled = sp.billing === "disabled" || !billingEnabled();
  return (
    <div className="flex flex-col gap-8">
      <div className="rule-double pb-4 text-center">
        <h1 className="text-title font-black">{t.pricing.title}</h1>
        <p className="text-muted-foreground mt-2">{t.pricing.subtitle}</p>
      </div>
      <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
        <PlanCard
          name={t.pricing.free}
          price={PLANS.FREE.priceIls}
          per={t.pricing.perMonth}
          features={t.pricing.freeFeatures}
          footer={plan === "FREE" ? <span className="chip">{t.pricing.current}</span> : null}
        />
        <PlanCard
          name={t.pricing.pro}
          price={PLANS.PRO.priceIls}
          per={t.pricing.perMonth}
          features={t.pricing.proFeatures}
          highlight
          footer={
            plan === "PRO" ? (
              <span className="chip">{t.pricing.current}</span>
            ) : (
              <form action={startCheckout}>
                <button className="btn-primary w-full" type="submit">
                  {t.pricing.upgrade}
                </button>
              </form>
            )
          }
        />
      </div>
      {showDisabled && <p className="text-muted-foreground text-center text-sm">{t.pricing.billingDisabled}</p>}
    </div>
  );
}

function PlanCard({
  name,
  price,
  per,
  features,
  footer,
  highlight,
}: {
  name: string;
  price: number;
  per: string;
  features: string[];
  footer: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`card flex flex-col gap-4 ${highlight ? "border-primary border-2 shadow-[4px_4px_0_var(--primary)]" : ""}`}
    >
      <h2 className="text-xl font-semibold">{name}</h2>
      <div>
        <span className="text-3xl font-bold">₪{price}</span> <span className="text-muted-foreground">{per}</span>
      </div>
      <ul className="flex flex-1 flex-col gap-2 text-sm">
        {features.map((f) => (
          <li key={f}>✓ {f}</li>
        ))}
      </ul>
      {footer}
    </div>
  );
}
