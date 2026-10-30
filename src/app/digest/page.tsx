import Link from "next/link";
import { Newspaper, Settings } from "lucide-react";
import { GenerateDigest } from "@/components/digest/GenerateDigest";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { digestIsEmpty, digestSummary, formatDay, parseDigestData } from "@/lib/digest/build";
import { getLocale } from "@/lib/i18n";
import { notificationStrings } from "@/lib/i18n/notifications";
import { reminderStrings } from "@/lib/i18n/reminders";
import { dayKey } from "@/lib/learning/progress";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { localizedTitle } from "@/lib/i18n/titles";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("digest");

export default async function DigestListPage() {
  const user = await requireUser("/digest");
  const locale = await getLocale();
  const r = reminderStrings(locale);
  const n = notificationStrings(locale);
  const digests = await db.digest.findMany({
    where: { userId: user.id },
    orderBy: { day: "desc" },
    take: 60,
    select: { id: true, day: true, summary: true, content: true },
  });
  const hasToday = digests[0]?.day === dayKey(new Date());

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="rule-double flex flex-col gap-2 pb-4">
        <p className="kicker">{r.kicker}</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-title font-black">{r.title}</h1>
          <Button asChild variant="ghost" size="sm">
            <Link href="/settings/notifications#digest-h">
              <Settings data-icon="inline-start" aria-hidden />
              {r.settingsLink}
            </Link>
          </Button>
        </div>
        <p className="text-muted-foreground max-w-prose leading-relaxed">{r.lead}</p>
        <GenerateDigest
          label={hasToday ? r.regenerate : r.generateNow}
          labels={{
            generating: r.generating,
            ok: r.generatedOk,
            sent: r.generatedSent,
            failed: n.invalid,
            open: r.dgOpen,
          }}
        />
      </header>

      {digests.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-10 text-center">
          <Newspaper className="text-muted-foreground size-8" aria-hidden />
          <p className="text-muted-foreground max-w-sm">{r.empty}</p>
        </div>
      ) : (
        <section aria-labelledby="history-h" className="flex flex-col gap-2">
          <h2 id="history-h" className="font-heading text-lg font-bold">
            {r.history}
          </h2>
          <ul className="card divide-y p-0" data-testid="digest-list">
            {digests.map((d) => {
              const data = parseDigestData(d.content);
              const quiet = !data || digestIsEmpty(data);
              return (
                <li key={d.id}>
                  <Link
                    href={`/digest/${d.id}`}
                    className="hover:bg-muted/50 flex items-start gap-3 p-4 transition-colors"
                  >
                    <Newspaper
                      className={cn("mt-0.5 size-5 shrink-0", quiet ? "text-muted-foreground" : "text-primary")}
                      aria-hidden
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-semibold">{formatDay(d.day, locale)}</span>
                      <span className="text-muted-foreground text-sm">
                        {quiet ? r.quietDay : digestSummary(data, locale)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
