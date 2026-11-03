import { Flame, ShieldCheck } from "lucide-react";
import { aiEnabled } from "@/lib/ai";
import { getDictionary } from "@/lib/i18n";
import { fillO, outreachAssistantStrings } from "@/lib/i18n/outreach-assistant";
import { localizedTitle } from "@/lib/i18n/titles";
import { loadOutreachDashboard } from "@/lib/outreach/server";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { OutreachAssistant } from "@/components/outreach/assistant/OutreachAssistant";
import { OutreachPrefsForm } from "@/components/outreach/assistant/OutreachPrefsForm";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("outreach");

/** LinkedIn outreach assistant (#86, docs/outreach-assistant.md). Drafts and tracking only — never sends. */
export default async function OutreachPage() {
  const user = await requireUser("/outreach");
  const [{ t, locale }, data] = await Promise.all([getDictionary(), loadOutreachDashboard(user.id)]);
  const s = outreachAssistantStrings[locale];
  const { progress, prefs } = data;
  const pct = Math.min(100, Math.round((progress.today / progress.goal) * 100));
  const dayFmt = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", { weekday: "narrow", timeZone: "UTC" });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="rule-double pb-4">
        <p className="kicker">{s.kicker}</p>
        <h1 className="text-title mt-1 font-black">{s.title}</h1>
        <p className="text-muted-foreground mt-2">{s.lead}</p>
        <p
          className="mt-3 flex items-start gap-2 rounded-md border border-emerald-600/30 bg-emerald-600/5 p-3 text-sm"
          data-testid="outreach-no-auto"
        >
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden />
          <span>{s.noAuto}</span>
        </p>
      </header>

      <section className="bg-card flex flex-col gap-3 rounded-lg border p-4" data-testid="outreach-goal">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-lg font-bold">{s.goalTitle}</h2>
          <p className="text-sm font-semibold" data-testid="outreach-goal-count">
            {fillO(s.goalOf, { n: progress.today, goal: progress.goal })}
          </p>
        </div>
        <div
          className="bg-muted h-2.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.goal}
          aria-valuenow={progress.today}
          aria-label={s.goalTitle}
        >
          <div
            className={cn("h-full rounded-full", progress.met ? "bg-fit" : "bg-primary")}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-sm">{progress.met ? s.goalMet : fillO(s.goalLeft, { n: progress.goal - progress.today })}</p>
        <p className="flex items-center gap-1.5 text-sm font-semibold" data-testid="outreach-streak">
          <Flame className={cn("size-4", progress.streak ? "text-orange-600" : "text-muted-foreground")} aria-hidden />
          {progress.streak ? fillO(s.streak, { n: progress.streak }) : s.streakNone}
        </p>
        <div>
          <p className="text-muted-foreground mb-1 text-xs">{s.weekLabel}</p>
          <ol className="flex gap-1.5" dir="ltr">
            {progress.week.map((d) => (
              <li
                key={d.day}
                className={cn(
                  "flex size-9 flex-col items-center justify-center rounded-md border text-[11px] leading-tight",
                  d.met ? "border-fit bg-fit/15 font-bold" : d.count ? "bg-muted" : "",
                )}
                title={`${d.day}: ${d.count}`}
              >
                <span aria-hidden>{dayFmt.format(new Date(`${d.day}T12:00:00Z`))}</span>
                <span>{d.count}</span>
              </li>
            ))}
          </ol>
        </div>
        <details className="border-t pt-2">
          <summary className="text-primary min-h-11 cursor-pointer content-center text-sm font-semibold sm:min-h-0">
            {s.settings}
          </summary>
          <OutreachPrefsForm prefs={prefs} s={s} />
        </details>
      </section>

      <OutreachAssistant
        queue={data.queue}
        contacts={data.contacts}
        canAi={aiEnabled()}
        locale={locale}
        s={s}
        t={t.people}
      />
    </div>
  );
}
