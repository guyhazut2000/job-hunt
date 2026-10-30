import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BellRing, Pause, Play, Search, Trash2 } from "lucide-react";
import { deleteSavedSearch, toggleSavedSearch, unfollowCompany } from "@/app/notification-actions";
import { PrefsForm } from "@/components/notifications/PrefsForm";
import { PushToggle } from "@/components/notifications/PushToggle";
import { TelegramConnect } from "@/components/notifications/TelegramConnect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { getLocale } from "@/lib/i18n";
import { fill, notificationStrings } from "@/lib/i18n/notifications";
import { reminderStrings } from "@/lib/i18n/reminders";
import { isTelegramConfigured, vapidConfig } from "@/lib/notifications/config";
import { CHANNEL_TYPES } from "@/lib/notifications/kinds";
import { toEffective } from "@/lib/notifications/prefs";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notification settings" };

export default async function NotificationSettingsPage() {
  const user = await requireUser("/settings/notifications");
  const locale = await getLocale();
  const s = notificationStrings(locale);
  const [prefsRow, channels, searches, follows] = await Promise.all([
    db.notificationPreference.findUnique({ where: { userId: user.id } }),
    db.notificationChannel.findMany({ where: { userId: user.id }, select: { type: true } }),
    db.savedSearch.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.companyFollow.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { company: { select: { id: true, name: true, slug: true } } },
    }),
  ]);
  const prefs = toEffective(prefsRow);
  const pushCount = channels.filter((c) => c.type === CHANNEL_TYPES.push).length;
  const tgCount = channels.filter((c) => c.type === CHANNEL_TYPES.telegram).length;
  const dateLocale = locale === "he" ? "he-IL" : "en-GB";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="rule-double flex flex-col gap-2 pb-4">
        <Link
          href="/notifications"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-8 w-fit items-center gap-1 text-sm"
        >
          <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
          {s.back}
        </Link>
        <p className="kicker">{s.kicker}</p>
        <h1 className="text-title font-black">{s.settingsTitle}</h1>
        <p className="text-muted-foreground max-w-prose leading-relaxed">{s.settingsLead}</p>
      </header>

      <section aria-labelledby="ch-h" className="card flex flex-col gap-5">
        <h2 id="ch-h" className="font-heading text-lg font-bold">
          {s.channels}
        </h2>
        <div className="flex flex-col gap-2">
          <h3 className="flex flex-wrap items-center gap-2 font-semibold">
            {s.pushTitle}
            {pushCount > 0 && <Badge variant="outline">{fill(s.pushDevices, { n: pushCount })}</Badge>}
          </h3>
          <p className="text-muted-foreground text-sm">{s.pushLead}</p>
          <PushToggle publicKey={vapidConfig()?.publicKey ?? null} hasChannels={channels.length > 0} labels={s} />
        </div>
        <div className="flex flex-col gap-2 border-t pt-4">
          <h3 className="font-semibold">{s.telegramTitle}</h3>
          <p className="text-muted-foreground text-sm">{s.telegramLead}</p>
          <TelegramConnect configured={isTelegramConfigured()} connected={tgCount} labels={s} />
        </div>
      </section>

      <section id="saved-searches" aria-labelledby="ss-h" className="card flex scroll-mt-24 flex-col gap-3">
        <h2 id="ss-h" className="font-heading text-lg font-bold">
          {s.savedSearches}
        </h2>
        <p className="text-muted-foreground text-sm">{s.savedSearchesLead}</p>
        {searches.length === 0 ? (
          <p className="text-sm">{s.noSavedSearches}</p>
        ) : (
          <ul className="divide-y rounded-md border" data-testid="saved-searches">
            {searches.map((ss) => (
              <li key={ss.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 font-semibold">
                    <Search className="text-muted-foreground size-4" aria-hidden />
                    <span className="truncate">{ss.name}</span>
                    {!ss.active && <Badge variant="secondary">{s.paused}</Badge>}
                  </span>
                  {ss.lastNotifiedAt && (
                    <span className="text-muted-foreground text-xs">
                      {fill(s.lastAlert, { time: formatDateTime(ss.lastNotifiedAt, dateLocale) })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/jobs${ss.query ? `?${ss.query}` : ""}`}>{s.open}</Link>
                  </Button>
                  <form action={toggleSavedSearch.bind(null, ss.id)}>
                    <Button type="submit" variant="ghost" size="sm">
                      {ss.active ? (
                        <Pause data-icon="inline-start" aria-hidden />
                      ) : (
                        <Play data-icon="inline-start" aria-hidden />
                      )}
                      {ss.active ? s.pause : s.resume}
                    </Button>
                  </form>
                  <form action={deleteSavedSearch.bind(null, ss.id)}>
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                      <Trash2 data-icon="inline-start" aria-hidden />
                      {s.remove}
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="followed-companies" aria-labelledby="fc-h" className="card flex scroll-mt-24 flex-col gap-3">
        <h2 id="fc-h" className="font-heading text-lg font-bold">
          {s.followedCompanies}
        </h2>
        <p className="text-muted-foreground text-sm">{s.followedCompaniesLead}</p>
        {follows.length === 0 ? (
          <p className="text-sm">{s.noFollowedCompanies}</p>
        ) : (
          <ul className="divide-y rounded-md border" data-testid="followed-companies">
            {follows.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 font-semibold">
                    <BellRing className="text-muted-foreground size-4" aria-hidden />
                    <Link href={`/companies/${f.company.slug}`} className="truncate hover:underline">
                      {f.company.name}
                    </Link>
                  </span>
                  {f.lastNotifiedAt && (
                    <span className="text-muted-foreground text-xs">
                      {fill(s.lastAlert, { time: formatDateTime(f.lastNotifiedAt, dateLocale) })}
                    </span>
                  )}
                </div>
                <form action={unfollowCompany.bind(null, f.company.id)}>
                  <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                    <Trash2 data-icon="inline-start" aria-hidden />
                    {s.unfollow}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PrefsForm prefs={prefs} s={s} r={reminderStrings(locale)} />
    </div>
  );
}
