import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getLocale } from "@/lib/i18n";
import { rankingStrings } from "@/lib/i18n/ranking";
import { localizedTitle } from "@/lib/i18n/titles";
import { EMPTY_PREFS } from "@/lib/ranking/personal";
import { getRankingPrefs } from "@/lib/ranking/server";
import { RankingForm } from "@/components/ranking/RankingForm";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("jobRanking");

export default async function RankingPage() {
  const user = await requireUser("/jobs/ranking");
  const [locale, prefs] = await Promise.all([getLocale(), getRankingPrefs(user.id)]);
  const s = rankingStrings(locale);
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
      <RankingForm initial={prefs ?? EMPTY_PREFS} s={s} />
    </div>
  );
}
