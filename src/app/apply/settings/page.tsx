import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { blockCompanyAction, saveApplySettingsAction, unblockCompanyAction } from "@/app/apply/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { autoApplyStrings } from "@/lib/i18n/auto-apply";
import { localizedTitle } from "@/lib/i18n/titles";
import { getApplySettings } from "@/lib/auto-apply/server";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("applySettings");

export default async function ApplySettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("/apply/settings");
  const locale = await getLocale();
  const s = autoApplyStrings(locale);
  const query = await searchParams;
  const settings = await getApplySettings(user.id);
  const blocked = settings.blockedCompanyIds.length
    ? await db.company.findMany({
        where: { id: { in: settings.blockedCompanyIds } },
        select: { id: true, name: true, nameHe: true },
        orderBy: { name: "asc" },
      })
    : [];
  const block = typeof query.block === "string" ? query.block : "";
  const saved = query.saved === "1";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="rule-double flex flex-col gap-2 pb-4">
        <Link
          href="/apply"
          className="text-muted-foreground inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold"
        >
          <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
          {s.backToQueue}
        </Link>
        <p className="kicker">{s.kicker}</p>
        <h1 className="text-title font-black">{s.settingsTitle}</h1>
        <p className="text-muted-foreground max-w-prose leading-relaxed">{s.settingsLead}</p>
      </header>

      <form action={saveApplySettingsAction} className="card flex flex-col gap-4">
        {saved && <p className="text-sm font-semibold">{s.saved}</p>}
        <label className="flex flex-col gap-1 text-sm font-semibold" htmlFor="minMatchScore">
          {s.minScore}
          <Input
            id="minMatchScore"
            name="minMatchScore"
            type="number"
            min={0}
            max={100}
            step={1}
            required
            defaultValue={settings.minMatchScore}
          />
          <span className="text-muted-foreground font-normal">{s.minScoreHint}</span>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold" htmlFor="dailyCap">
          {s.dailyCap}
          <Input
            id="dailyCap"
            name="dailyCap"
            type="number"
            min={0}
            max={25}
            step={1}
            required
            defaultValue={settings.dailyCap}
          />
          <span className="text-muted-foreground font-normal">{s.dailyCapHint}</span>
        </label>
        <label className="flex min-h-11 items-start gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            name="fullyAutomatic"
            defaultChecked={settings.fullyAutomatic}
            className="accent-foreground mt-1 size-4"
          />
          <span>
            {s.automatic}
            <span className="text-muted-foreground mt-1 block font-normal">{s.automaticHint}</span>
          </span>
        </label>
        <Button type="submit">{s.save}</Button>
      </form>

      <section className="card flex flex-col gap-3" aria-labelledby="blocked-h">
        <h2 id="blocked-h" className="font-heading text-lg font-bold">
          {s.blocked}
        </h2>
        <p className="text-muted-foreground text-sm">{s.blockedHint}</p>
        {block === "missing" && (
          <p role="alert" className="text-destructive text-sm font-semibold">
            {s.blockMissing}
          </p>
        )}
        {block === "ambiguous" && (
          <p role="alert" className="text-destructive text-sm font-semibold">
            {s.blockAmbiguous}
          </p>
        )}
        {blocked.length === 0 ? (
          <p className="text-sm">{s.blockEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {blocked.map((company) => (
              <li key={company.id} className="flex items-center justify-between gap-2">
                <span>{locale === "he" && company.nameHe ? company.nameHe : company.name}</span>
                <form action={unblockCompanyAction}>
                  <input type="hidden" name="companyId" value={company.id} />
                  <Button type="submit" variant="outline" size="sm">
                    {s.blockRemove}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={blockCompanyAction} className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="company">
            {s.blocked}
          </label>
          <Input id="company" name="company" required maxLength={120} />
          <Button type="submit" variant="secondary">
            {s.blockAdd}
          </Button>
        </form>
      </section>
    </div>
  );
}
