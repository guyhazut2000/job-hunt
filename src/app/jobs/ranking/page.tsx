import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getDictionary } from "@/lib/i18n";
import { rankingStrings } from "@/lib/i18n/ranking";
import { localizedTitle } from "@/lib/i18n/titles";
import { EMPTY_PREFS, type WeightKey } from "@/lib/ranking/personal";
import { getRankingPrefs } from "@/lib/ranking/server";
import { inferSeniorityFromYears, toCandidate } from "@/lib/profile/score";
import { RankingForm } from "@/components/ranking/RankingForm";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("jobRanking");

export default async function RankingPage() {
  const user = await requireUser("/jobs/ranking");
  const [{ locale, t }, prefs, profile] = await Promise.all([
    getDictionary(),
    getRankingPrefs(user.id),
    db.profile.findUnique({ where: { userId: user.id } }),
  ]);
  const s = rankingStrings(locale);
  // What each criterion uses from the profile, so "default from profile" is visible (empty = not set → not counted).
  const c = profile ? toCandidate(profile) : null;
  const list = (xs: string[]) => xs.join(", ");
  const seniorities = c?.targetSeniorities.length
    ? c.targetSeniorities
    : c?.totalYears != null
      ? [inferSeniorityFromYears(c.totalYears)]
      : [];
  const hints: Partial<Record<WeightKey, string>> = {
    salary: profile?.salaryMin ? `₪${profile.salaryMin.toLocaleString("en-US")}` : "",
    seniority: list(seniorities.map((x) => t.seniority[x] ?? x)),
    tech: c?.skills.length ? String(c.skills.length) : "",
    location: list((c?.regions ?? []).map((r) => t.pv2.regionNames[r] ?? r)),
    commute: profile?.location?.trim() ?? "",
    workMode: list((c?.workModes ?? []).map((m) => t.workMode[m] ?? m)),
    companySize: list(
      (profile?.companyTypes ?? []).map((x) => (t.pv2.companyTypeNames as Record<string, string>)[x] ?? x),
    ),
  };
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="rule-double pb-4">
        <Link
          href="/jobs"
          className="text-muted-foreground inline-flex min-h-11 items-center gap-1 text-sm hover:underline"
        >
          <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
          {s.backToJobs}
        </Link>
        <h1 className="text-title mt-1 font-black">{s.title}</h1>
        <p className="text-muted-foreground mt-2">{s.lead}</p>
      </header>
      <RankingForm initial={prefs ?? EMPTY_PREFS} s={s} hints={hints} />
    </div>
  );
}
