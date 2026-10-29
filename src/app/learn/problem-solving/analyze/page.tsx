import Link from "next/link";
import { auth } from "@/auth";
import { AnalyzeForm } from "@/components/problem-solving/AnalyzeForm";
import { PageHead } from "@/components/problem-solving/PageHead";
import { Button } from "@/components/ui/button";
import { patternName } from "@/lib/algo/patterns";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { problemSolvingStrings } from "@/lib/i18n/problem-solving";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analyze a problem" };

export default async function AnalyzePage() {
  const [locale, session] = await Promise.all([getLocale(), auth()]);
  const t = problemSolvingStrings(locale);
  const userId = session?.user?.id;
  const recent = userId
    ? await db.patternAttempt.findMany({
        where: { userId, mode: "paste" },
        select: { id: true, problemText: true, picked: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      })
    : [];
  return (
    <div className="flex flex-col gap-8">
      <PageHead kicker={t.title} title={t.analyzeTitle} lead={t.analyzeLead} />
      {userId ? (
        <AnalyzeForm locale={locale} t={t} />
      ) : (
        <aside className="bg-card flex flex-col items-start gap-3 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold">{t.loginToPractice}</p>
          <Button asChild className="rounded-full px-5">
            <Link href="/login?next=/learn/problem-solving/analyze">{t.login}</Link>
          </Button>
        </aside>
      )}
      {recent.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="kicker">{t.recentAnalyses}</h2>
          <ul className="flex flex-col divide-y rounded-xl border text-sm">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-col gap-0.5 px-3 py-2">
                <span dir="auto" className="line-clamp-1">
                  {r.problemText}
                </span>
                <span dir="ltr" className="text-muted-foreground text-start text-xs rtl:text-end">
                  {r.picked.map(patternName).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
