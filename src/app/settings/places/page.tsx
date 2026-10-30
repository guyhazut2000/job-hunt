import { ArrowRight, MapPin, ShieldCheck, Star } from "lucide-react";
import Link from "next/link";
import { makeDefaultPlace, removePlace } from "@/app/places-actions";
import { AddPlaceForm } from "@/components/map/AddPlaceForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { jobsMapStrings } from "@/lib/i18n/jobs-map";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saved places" };

export default async function PlacesSettingsPage() {
  const user = await requireUser("/settings/places");
  const s = jobsMapStrings(await getLocale());
  const places = await db.savedPlace.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="rule-double flex flex-col gap-2 pb-4">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-8 w-fit items-center gap-1 text-sm"
        >
          <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
          {s.back}
        </Link>
        <p className="kicker">{s.placesKicker}</p>
        <h1 className="text-title font-black">{s.placesTitle}</h1>
        <p className="text-muted-foreground max-w-prose leading-relaxed">{s.placesLead}</p>
      </header>

      <section className="card flex flex-col gap-4" aria-labelledby="places-h">
        <h2 id="places-h" className="font-heading text-lg font-bold">
          {s.savedPlaces}
        </h2>
        {places.length === 0 ? (
          <p className="text-muted-foreground text-sm">{s.noPlaces}</p>
        ) : (
          <ul className="divide-y rounded-md border" data-testid="places-list">
            {places.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="flex min-w-0 items-start gap-3">
                  <MapPin className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {p.label}
                      {p.isDefault && (
                        <Badge variant="outline" className="gap-1">
                          <Star className="size-3" aria-hidden />
                          {s.isDefault}
                        </Badge>
                      )}
                    </p>
                    <p className="text-muted-foreground truncate text-sm" dir="auto">
                      {p.address}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/jobs?view=map&origin=${p.id}`}>{s.showOnMap}</Link>
                  </Button>
                  {!p.isDefault && (
                    <form action={makeDefaultPlace}>
                      <input type="hidden" name="id" value={p.id} />
                      <Button type="submit" variant="outline" size="sm">
                        {s.makeDefault}
                      </Button>
                    </form>
                  )}
                  <form action={removePlace}>
                    <input type="hidden" name="id" value={p.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                      {s.remove}
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <AddPlaceForm s={s} />
        <p className="text-muted-foreground text-xs">{s.orUseMap}</p>
      </section>

      <p className="text-muted-foreground flex items-start gap-2 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        {s.privacy}
      </p>
    </div>
  );
}
