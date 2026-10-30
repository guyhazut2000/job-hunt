import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Megaphone } from "lucide-react";
import { getLocale } from "@/lib/i18n";
import { notificationStrings } from "@/lib/i18n/notifications";
import { entryText, WHATS_NEW } from "@/lib/whats-new";

export const metadata: Metadata = { title: "What's new" };

export default async function WhatsNewPage() {
  const locale = await getLocale();
  const s = notificationStrings(locale);
  const fmt = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  });
  const Arrow = locale === "he" ? ArrowLeft : ArrowRight;
  const byDate = new Map<string, typeof WHATS_NEW>();
  for (const e of WHATS_NEW) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="rule-double flex flex-col gap-2 pb-4">
        <p className="kicker">{s.whatsNewKicker}</p>
        <h1 className="text-title flex items-center gap-2 font-black">
          <Megaphone className="text-primary size-7 shrink-0" aria-hidden />
          {s.whatsNewNav}
        </h1>
        <p className="text-muted-foreground max-w-prose leading-relaxed">{s.whatsNewLead}</p>
      </header>
      <div className="flex flex-col gap-6" data-testid="whats-new">
        {[...byDate.entries()].map(([date, entries]) => (
          <section key={date} aria-labelledby={`d-${date}`} className="flex flex-col gap-3">
            <h2 id={`d-${date}`} className="text-muted-foreground text-sm font-semibold">
              <time dateTime={date}>{fmt.format(new Date(`${date}T12:00:00+02:00`))}</time>
            </h2>
            <ul className="flex flex-col gap-3">
              {entries.map((e) => {
                const text = entryText(e, locale);
                return (
                  <li key={e.id} id={e.id} className="card flex flex-col gap-2">
                    <h3 className="font-heading text-lg leading-snug font-bold">{text.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{text.body}</p>
                    {e.url && (
                      <Link
                        href={e.url}
                        className="text-primary inline-flex min-h-10 items-center gap-1 self-start text-sm font-semibold hover:underline"
                      >
                        {s.whatsNewOpen}
                        <Arrow className="size-4" aria-hidden />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
