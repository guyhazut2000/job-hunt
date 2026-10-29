import type { Metadata } from "next";
import Link from "next/link";
import {
  BellOff,
  BriefcaseBusiness,
  CalendarClock,
  CheckCheck,
  Clock,
  GraduationCap,
  Newspaper,
  Settings,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { markAllNotificationsRead } from "@/app/notification-actions";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { getLocale } from "@/lib/i18n";
import { notificationStrings } from "@/lib/i18n/notifications";
import { reminderStrings } from "@/lib/i18n/reminders";
import { isKind } from "@/lib/notifications/kinds";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifications" };

const ICONS: Record<string, LucideIcon> = {
  JOB_MATCH: BriefcaseBusiness,
  SAVED_JOB_CLOSED: XCircle,
  FOLLOW_UP: Clock,
  INTERVIEW: CalendarClock,
  LEARNING: GraduationCap,
  DIGEST: Newspaper,
  SYSTEM: Sparkles,
};

export default async function NotificationsPage() {
  const user = await requireUser();
  const locale = await getLocale();
  const s = notificationStrings(locale);
  const items = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = items.filter((n) => !n.readAt).length;
  const dateLocale = locale === "he" ? "he-IL" : "en-GB";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="rule-double flex flex-col gap-2 pb-4">
        <p className="kicker">{s.kicker}</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-title font-black">{s.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {unread > 0 && (
              <form action={markAllNotificationsRead}>
                <Button type="submit" variant="outline" size="sm" data-testid="mark-all-read">
                  <CheckCheck data-icon="inline-start" aria-hidden />
                  {s.markAllRead}
                </Button>
              </form>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link href="/digest">
                <Newspaper data-icon="inline-start" aria-hidden />
                {reminderStrings(locale).nav}
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/settings/notifications">
                <Settings data-icon="inline-start" aria-hidden />
                {s.settings}
              </Link>
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground max-w-prose leading-relaxed">{s.lead}</p>
      </header>

      {items.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-10 text-center">
          <BellOff className="text-muted-foreground size-8" aria-hidden />
          <p className="text-muted-foreground max-w-sm">{s.empty}</p>
          <Button asChild size="sm">
            <Link href="/jobs">{s.allJobs}</Link>
          </Button>
        </div>
      ) : (
        <ul className="card divide-y p-0" data-testid="notification-list">
          {items.map((n) => {
            const Icon = ICONS[n.kind] ?? Sparkles;
            return (
              <li key={n.id}>
                <a
                  href={`/notifications/open/${n.id}`}
                  className={cn(
                    "hover:bg-muted/50 flex items-start gap-3 p-4 transition-colors",
                    !n.readAt && "bg-primary/[0.04]",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full",
                      n.readAt ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
                    )}
                  >
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className={cn("leading-snug", !n.readAt && "font-bold")}>{n.title}</span>
                      {!n.readAt && (
                        <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-px text-[0.65rem] font-bold">
                          {s.unread}
                        </span>
                      )}
                    </span>
                    {n.body && <span className="text-muted-foreground text-sm whitespace-pre-line">{n.body}</span>}
                    <span className="text-muted-foreground text-xs">
                      {isKind(n.kind) ? s.kinds[n.kind] : n.kind} · {formatDateTime(n.createdAt, dateLocale)}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
