import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/dictionaries";
import { cvTailorStrings } from "@/lib/i18n/cv-tailor";
import { fmt } from "@/lib/i18n/learning";

/** /profile?tab=documents: latest tailored CV per job / application, newest first. */
export async function TailoredCvList({ userId, locale }: { userId: string; locale: Locale }) {
  const t = cvTailorStrings(locale);
  const rows = await db.tailoredCv.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      jobId: true,
      applicationId: true,
      title: true,
      company: true,
      version: true,
      language: true,
      createdAt: true,
    },
    take: 200,
  });
  const groups = new Map<string, { latest: (typeof rows)[number]; count: number }>();
  for (const r of rows) {
    const key = r.jobId ? `j:${r.jobId}` : r.applicationId ? `a:${r.applicationId}` : `x:${r.id}`;
    const g = groups.get(key);
    if (g) g.count++;
    else groups.set(key, { latest: r, count: 1 });
  }
  const df = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "he-IL", {
    dateStyle: "medium",
    timeZone: "Asia/Jerusalem",
  });
  return (
    <section aria-labelledby="tailored-cvs" className="flex flex-col gap-3" data-testid="tailored-cvs">
      <h2 id="tailored-cvs" className="font-heading inline-flex items-center gap-2 text-xl font-bold">
        <FileText className="text-primary size-5" aria-hidden />
        {t.docsTitle}
      </h2>
      {groups.size === 0 ? (
        <p className="text-muted-foreground text-sm">{t.docsEmpty}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {[...groups.values()].map(({ latest, count }) => (
            <li key={latest.id}>
              <Link
                href={`/cv/tailor/${latest.id}`}
                className="bg-card hover:bg-secondary/60 flex min-h-14 items-center justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold" dir="auto">
                    {latest.title} · {latest.company}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {fmt(t.version, { n: latest.version })} · {fmt(t.docsCount, { n: count })} ·{" "}
                    {latest.language === "en" ? "EN" : "עב"} · {df.format(latest.createdAt)}
                  </span>
                </span>
                <ArrowLeft className="size-4 shrink-0 ltr:rotate-180" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
