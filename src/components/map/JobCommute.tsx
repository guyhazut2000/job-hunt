import Link from "next/link";
import { MapPinned } from "lucide-react";
import type { Company, Job } from "@prisma/client";
import { commuteForJobs } from "@/lib/commute/jobs";
import { DEFAULT_DEPARTURE } from "@/lib/commute/keys";
import { resolveOrigin } from "@/lib/commute/origin";
import { fillN, jobsMapStrings } from "@/lib/i18n/jobs-map";
import type { Locale } from "@/lib/i18n/dictionaries";
import { CommuteChips } from "./CommuteChips";

/**
 * Car / bus / train chips on the job page, from `?from=` (rounded point) or the user's default saved
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
  const { byJob } = await commuteForJobs([job], { origin: origin.point, departure: DEFAULT_DEPARTURE });
  const commute = byJob.get(job.id)?.commute;
  if (!commute) return null;
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
    </div>
  );
}
