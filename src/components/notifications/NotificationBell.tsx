"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Bell, CheckCheck, Settings } from "lucide-react";
import { markAllNotificationsRead } from "@/app/notification-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface BellItem {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
}

interface Labels {
  bell: string;
  bellUnread: string;
  viewAll: string;
  markAllRead: string;
  emptyShort: string;
  settings: string;
  unread: string;
}

const POLL_MS = 60_000;

function relative(iso: string, locale: string): string {
  const diff = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(0, "minute");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86_400), "day");
}

/** Header bell: unread badge (polled while the tab is visible) and a dropdown of the latest items. */
export function NotificationBell({
  initialUnread,
  labels,
  locale,
}: {
  initialUnread: number;
  labels: Labels;
  locale: string;
}) {
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<BellItem[] | null>(null);
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { unread: number; items: BellItem[] };
      setUnread(json.unread);
      setItems(json.items);
    } catch {
      // offline — keep the last known state
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  // Pages like /notifications mark things read; re-sync on navigation.
  useEffect(() => {
    void refresh();
  }, [pathname, refresh]);

  const label = unread ? labels.bellUnread.replace("{n}", String(unread)) : labels.bell;
  const shown = unread > 99 ? "99+" : String(unread);

  return (
    <DropdownMenu onOpenChange={(o) => o && void refresh()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} className="relative" data-testid="notification-bell">
          <Bell className="size-5" aria-hidden />
          {unread > 0 && (
            <span
              aria-hidden
              data-testid="notification-badge"
              className="bg-primary text-primary-foreground absolute -end-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[0.65rem] leading-none font-bold tabular-nums"
            >
              {shown}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <DropdownMenuLabel className="p-0 text-sm font-bold">{labels.bell}</DropdownMenuLabel>
          {unread > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  await markAllNotificationsRead();
                  await refresh();
                });
              }}
              className="text-primary inline-flex min-h-8 items-center gap-1 text-xs font-semibold hover:underline disabled:opacity-50"
            >
              <CheckCheck className="size-3.5" aria-hidden />
              {labels.markAllRead}
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
          {items === null ? (
            <p className="text-muted-foreground p-4 text-sm">…</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground p-4 text-sm">{labels.emptyShort}</p>
          ) : (
            items.map((n) => (
              <DropdownMenuItem key={n.id} asChild className="rounded-none px-3 py-2.5">
                <a href={`/notifications/open/${n.id}`} className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")}
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className={cn("line-clamp-2 text-sm", !n.read && "font-semibold")}>
                      {!n.read && <span className="sr-only">{labels.unread}: </span>}
                      {n.title}
                    </span>
                    {n.body && <span className="text-muted-foreground line-clamp-1 text-xs">{n.body}</span>}
                    <span className="text-muted-foreground text-[0.7rem]">{relative(n.createdAt, locale)}</span>
                  </span>
                </a>
              </DropdownMenuItem>
            ))
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="flex items-center justify-between gap-2 p-1">
          <DropdownMenuItem asChild>
            <Link href="/notifications" className="font-semibold">
              {labels.viewAll}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings/notifications" aria-label={labels.settings}>
              <Settings className="size-4" aria-hidden />
            </Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
