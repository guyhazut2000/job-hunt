import Link from "next/link";
import { MapPinned } from "lucide-react";
import type { Company, Job } from "@prisma/client";
import { commuteForJobs } from "@/lib/commute/jobs";
import { DEFAULT_DEPARTURE, destKey } from "@/lib/commute/keys";
import { getTransitRoute } from "@/lib/commute/service";
import { resolveOrigin } from "@/lib/commute/origin";
import { fillN, jobsMapStrings } from "@/lib/i18n/jobs-map";
import type { Locale } from "@/lib/i18n/dictionaries";
import { CommuteChips } from "./CommuteChips";
import { TransitRouteView } from "./TransitRoute";

/**
 * Car / public-transport chips plus the transit leg breakdown on the job page, from `?from=` (rounded point) or the user's default saved
 * place. Rendered inside <Suspense> so a cold routing call never blocks the page.
 */
export async function JobCommute({
  job,
  userId,
  from,
  locale,
}: {
  job: Job & { company: Company };
  userId?: string;
  from?: string;
  locale: Locale;
}) {
  if (job.workMode === "REMOTE" || job.geoPlaces.length === 0) return null;
  const s = jobsMapStrings(locale);
  const origin = await resolveOrigin({ from }, userId, true);
  if (!origin) {
    return userId ? (
      <Link
        href="/settings/places"
        className="text-muted-foreground hover:text-foreground inline-flex min-h-9 w-fit items-center gap-1.5 text-sm underline underline-offset-4"
      >
        <MapPinned className="size-4" aria-hidden />
        {s.setPlaceHint}
      </Link>
    ) : null;
  }
  const { byJob, batch } = await commuteForJobs([job], { origin: origin.point, departure: DEFAULT_DEPARTURE });
  const jc = byJob.get(job.id);
  const commute = jc?.commute;
  if (!commute) return null;
  // Leg breakdown to the job's closest routed place (multi-city jobs: the fastest office).
  const routedPlace = (jc?.points ?? [])
    .map((p) => ({ p, v: batch.times.get(destKey(p))?.transit }))
    .filter((x) => x.v?.source === "transitous" && x.v.seconds != null)
    .sort((a, b) => a.v!.seconds! - b.v!.seconds!)[0]?.p;
  const route = routedPlace
    ? await getTransitRoute({ origin: origin.point, dest: routedPlace, departure: DEFAULT_DEPARTURE }).catch(() => null)
    : null;
  const mapHref = `/jobs?view=map&company=${encodeURIComponent(job.company.slug)}${
    origin.source === "here"
      ? `&from=${encodeURIComponent(from ?? "")}`
      : origin.placeId
        ? `&origin=${origin.placeId}`
        : ""
  }`;
  return (
    <div className="flex flex-col gap-1.5" data-testid="job-commute">
      <p className="text-muted-foreground text-xs font-semibold">
        {fillN(s.commuteFromPlace, { place: origin.label ?? s.customPoint })} · {s.days["sun-thu"]} 08:30
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <CommuteChips commute={commute} s={s} />
        <Link
          href={mapHref}
          className="text-primary inline-flex min-h-9 items-center text-sm font-semibold hover:underline"
        >
          {s.showOnMap}
        </Link>
      </div>
      {route?.route ? (
        <TransitRouteView route={route.route} s={s} locale={locale} />
      ) : commute.transit?.estimateReason === "no-route" ? (
        <p className="text-muted-foreground text-xs">{s.noItinerary}</p>
      ) : null}
    </div>
  );
}
