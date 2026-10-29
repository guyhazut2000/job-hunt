import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Lightbulb } from "lucide-react";
import { db } from "@/lib/db";
import {
  digestSections,
  formatDay,
  parseDigestData,
  parseSuggestions,
  type SuggestionSource,
} from "@/lib/digest/build";
import { formatDateTime } from "@/lib/format";
import { getLocale } from "@/lib/i18n";
import { fill } from "@/lib/i18n/notifications";
import { reminderStrings } from "@/lib/i18n/reminders";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Daily digest" };

export default async function DigestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const locale = await getLocale();
  const r = reminderStrings(locale);
  const row = await db.digest.findFirst({ where: { id, userId: user.id } });
  const data = row ? parseDigestData(row.content) : null;
  if (!row || !data) notFound();
  const sections = digestSections(data, locale);
  const suggestions = parseSuggestions(row.suggestions);
  const source = (["ai", "offline", "limited"].includes(row.aiSource) ? row.aiSource : "offline") as SuggestionSource;
  const dateLocale = locale === "he" ? "he-IL" : "en-GB";
  const Back = locale === "he" ? ArrowRight : ArrowLeft;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="rule-double flex flex-col gap-2 pb-4">
        <Link
          href="/digest"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-10 items-center gap-1 self-start text-sm font-semibold"
        >
          <Back className="size-4" aria-hidden />
          {r.back}
        </Link>
        <p className="kicker">{r.title}</p>
        <h1 className="text-title font-black">{formatDay(row.day, locale)}</h1>
        <p className="text-muted-foreground leading-relaxed">{row.summary}</p>
        <p className="text-muted-foreground text-xs">
          {fill(r.window, {
            from: formatDateTime(new Date(data.since), dateLocale),
            to: formatDateTime(new Date(data.generatedAt), dateLocale),
          })}
        </p>
      </header>

      <section aria-labelledby="streamline-h" className="card border-primary/40 flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="streamline-h" className="font-heading flex items-center gap-2 text-lg font-bold">
            <Lightbulb className="text-primary size-5" aria-hidden />
            {r.dgStreamline}
          </h2>
          <span className="text-muted-foreground text-xs">{r.aiSource[source]}</span>
        </div>
        <ol className="flex flex-col gap-3" data-testid="digest-suggestions">
          {suggestions.map((sg, i) => (
            <li key={i} className="flex gap-3">
              <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold">
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                {sg.url ? (
                  <Link href={sg.url} className="font-semibold underline-offset-4 hover:underline" dir="auto">
                    {sg.title}
                  </Link>
                ) : (
                  <span className="font-semibold" dir="auto">
                    {sg.title}
                  </span>
                )}
                <span className="text-muted-foreground text-sm" dir="auto">
                  {sg.detail}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-4 sm:grid-cols-2" data-testid="digest-sections">
        {sections.map((sec) => (
          <section key={sec.key} aria-labelledby={`sec-${sec.key}`} className="card flex flex-col gap-2">
            <h2 id={`sec-${sec.key}`} className="font-heading flex items-center gap-2 text-base font-bold">
              <span aria-hidden>{sec.icon}</span>
              {sec.title}
              {sec.count > 0 && <span className="text-muted-foreground ms-auto font-mono text-xs">{sec.count}</span>}
            </h2>
            {sec.items.length === 0 ? (
              <p className="text-muted-foreground text-sm">{sec.empty}</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {sec.items.map((it, i) => (
                  <li key={i} dir="auto">
                    {it.url ? (
                      <Link href={it.url} className="hover:text-primary underline-offset-4 hover:underline">
                        {it.text}
                      </Link>
                    ) : (
                      it.text
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
