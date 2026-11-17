import Link from "next/link";
import { ChevronLeft, ChevronRight, MapPin, MonitorSmartphone, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireActivityViewer } from "@/lib/activity/access";
import {
  activitySummary,
  listActivity,
  parseActivityFilters,
  type ActivityFilters,
  type ActivityRow,
} from "@/lib/activity/query";
import { ACTIVITY_TYPES } from "@/lib/activity/types";
import { formatDateTime } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { activityStrings, type ActivityStrings } from "@/lib/i18n/activity";
import { localizedTitle } from "@/lib/i18n/titles";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("adminActivity");

const TYPE_TONE: Record<string, string> = {
  sign_in: "bg-emerald-100 text-emerald-900",
  sign_up: "bg-sky-100 text-sky-900",
  sign_out: "bg-muted text-muted-foreground",
  sign_in_failed: "bg-red-100 text-red-900",
  page_view: "bg-secondary text-secondary-foreground",
};

function placeLabel(r: Pick<ActivityRow, "country" | "city" | "region">, locale: string): string | null {
  let country = r.country ?? null;
  if (country) {
    try {
      country = new Intl.DisplayNames([locale], { type: "region" }).of(country) ?? country;
    } catch {
      // keep the code
    }
  }
  return [r.city, country].filter(Boolean).join(", ") || null;
}

function deviceLabel(r: Pick<ActivityRow, "device" | "browser" | "os">, s: ActivityStrings): string | null {
  return [r.device ? (s.devices[r.device] ?? r.device) : null, r.os, r.browser].filter(Boolean).join(" · ") || null;
}

function hrefWith(f: ActivityFilters, page: number) {
  const q = new URLSearchParams();
  if (f.user) q.set("user", f.user);
  if (f.type) q.set("type", f.type);
  if (f.from) q.set("from", f.from);
  if (f.to) q.set("to", f.to);
  if (page > 1) q.set("page", String(page));
  const qs = q.toString();
  return `/admin/activity${qs ? `?${qs}` : ""}`;
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireActivityViewer();
  const [{ locale }, sp] = await Promise.all([getDictionary(), searchParams]);
  const s = activityStrings(locale);
  const f = parseActivityFilters(sp);
  const [summary, list] = await Promise.all([activitySummary(), listActivity(f)]);
  const nf = new Intl.NumberFormat(locale);
  const cards = [
    { label: s.activeToday, value: summary.activeToday },
    { label: s.active7d, value: summary.active7d },
    {
      label: s.signInsToday,
      value: summary.signInsToday,
      hint: summary.failedToday ? s.failedToday.replace("{n}", nf.format(summary.failedToday)) : null,
    },
  ];
  const userOf = (r: ActivityRow) => r.user?.name || r.user?.email || r.email || s.guest;
  const emailOf = (r: ActivityRow) => r.user?.email || r.email || null;

  return (
    <div className="flex flex-col gap-6" data-testid="activity-page">
      <div className="flex flex-col gap-1">
        <Link href="/admin" className="text-muted-foreground w-fit text-sm hover:underline">
          {s.backToAdmin}
        </Link>
        <h1 className="text-title font-black">{s.title}</h1>
        <p className="text-muted-foreground text-sm">{s.lead}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-4" data-testid="activity-summary">
        {cards.map((c) => (
          <div key={c.label} className="card flex flex-col gap-0.5 p-3 sm:p-4">
            <div className="text-muted-foreground text-xs sm:text-sm">{c.label}</div>
            <div className="text-2xl font-bold tabular-nums">{nf.format(c.value)}</div>
            {c.hint && <div className="text-xs font-semibold text-red-700">{c.hint}</div>}
          </div>
        ))}
        <div className="card col-span-3 flex flex-col gap-1.5 lg:col-span-1">
          <div className="text-muted-foreground text-sm">{s.topPages}</div>
          {summary.topPages.length ? (
            <ol className="flex flex-col gap-1 text-sm">
              {summary.topPages.map((p) => (
                <li key={p.path} className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs" dir="ltr">
                    {p.path}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {s.views.replace("{n}", nf.format(p.views))}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="text-muted-foreground text-sm">{s.noPages}</div>
          )}
        </div>
      </div>

      <form method="get" className="card grid grid-cols-2 gap-3 md:grid-cols-5 md:items-end" aria-label={s.filters}>
        <label className="col-span-2 flex flex-col gap-1 text-sm font-semibold md:col-span-1">
          {s.user}
          <Input
            name="user"
            defaultValue={f.user ?? ""}
            placeholder={s.userPlaceholder}
            list="activity-users"
            dir="ltr"
            className="text-start"
            data-testid="activity-filter-user"
          />
          <datalist id="activity-users">
            {summary.recentEmails.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-sm font-semibold md:col-span-1">
          {s.type}
          <select
            name="type"
            defaultValue={f.type ?? ""}
            className="border-input bg-card h-11 rounded-md border px-2 text-base md:text-sm"
            data-testid="activity-filter-type"
          >
            <option value="">{s.anyType}</option>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {s.types[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {s.from}
          <Input type="date" name="from" defaultValue={f.from ?? ""} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {s.to}
          <Input type="date" name="to" defaultValue={f.to ?? ""} />
        </label>
        <div className="col-span-2 flex gap-2 md:col-span-1">
          <Button type="submit" className="h-11 flex-1">
            {s.apply}
          </Button>
          <Button asChild variant="ghost" className="h-11">
            <Link href="/admin/activity">{s.clear}</Link>
          </Button>
        </div>
      </form>

      <section className="flex flex-col gap-3" aria-label={s.title}>
        <div className="text-muted-foreground text-sm" data-testid="activity-total">
          {s.total.replace("{n}", nf.format(list.total))}
        </div>
        {list.rows.length === 0 ? (
          <div className="card text-muted-foreground text-sm">{s.empty}</div>
        ) : (
          <>
            {/* Mobile: one card per event */}
            <ul className="flex flex-col gap-2 md:hidden" data-testid="activity-list">
              {list.rows.map((r) => {
                const place = placeLabel(r, locale);
                const device = deviceLabel(r, s);
                return (
                  <li key={r.id} className="card flex flex-col gap-1.5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-bold ${TYPE_TONE[r.type] ?? "bg-primary/12 text-primary"}`}
                      >
                        {s.types[r.type as keyof typeof s.types] ?? r.type}
                      </span>
                      <time className="text-muted-foreground text-xs tabular-nums" dateTime={r.createdAt.toISOString()}>
                        {formatDateTime(r.createdAt, locale)}
                      </time>
                    </div>
                    <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                      <UserRound aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
                      <span className="truncate" dir="auto">
                        {userOf(r)}
                      </span>
                    </div>
                    {r.path && (
                      <div className="truncate font-mono text-xs" dir="ltr">
                        {r.path}
                      </div>
                    )}
                    {(place || device) && (
                      <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {place && (
                          <span className="flex items-center gap-1">
                            <MapPin aria-hidden className="size-3" />
                            {place}
                          </span>
                        )}
                        {device && (
                          <span className="flex items-center gap-1">
                            <MonitorSmartphone aria-hidden className="size-3" />
                            {device}
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {/* Desktop: table */}
            <div className="card scroll-thin hidden overflow-x-auto p-0 md:block">
              <table className="w-full text-start text-sm" data-testid="activity-table">
                <thead className="text-muted-foreground border-b text-xs">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">{s.time}</th>
                    <th className="px-3 py-2 text-start font-medium">{s.user}</th>
                    <th className="px-3 py-2 text-start font-medium">{s.event}</th>
                    <th className="px-3 py-2 text-start font-medium">{s.page}</th>
                    <th className="px-3 py-2 text-start font-medium">{s.location}</th>
                    <th className="px-3 py-2 text-start font-medium">{s.device}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                        <time dateTime={r.createdAt.toISOString()}>{formatDateTime(r.createdAt, locale)}</time>
                      </td>
                      <td className="max-w-56 px-3 py-2">
                        <div className="truncate font-semibold" dir="auto">
                          {userOf(r)}
                        </div>
                        {emailOf(r) && emailOf(r) !== userOf(r) && (
                          <div className="text-muted-foreground truncate text-start text-xs" dir="ltr">
                            {emailOf(r)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="secondary"
                          className={`whitespace-nowrap ${TYPE_TONE[r.type] ?? "bg-primary/12 text-primary"}`}
                        >
                          {s.types[r.type as keyof typeof s.types] ?? r.type}
                        </Badge>
                      </td>
                      <td className="max-w-60 truncate px-3 py-2 text-start font-mono text-xs" dir="ltr">
                        {r.path ?? "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{placeLabel(r, locale) ?? "—"}</td>
                      <td className="text-muted-foreground px-3 py-2 text-xs whitespace-nowrap">
                        {deviceLabel(r, s) ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {list.pages > 1 && (
          <nav className="flex items-center justify-between gap-2" aria-label={s.pageOf}>
            <Button asChild variant="outline" size="sm" className={f.page <= 1 ? "invisible" : ""}>
              <Link href={hrefWith(f, f.page - 1)} rel="prev">
                <ChevronRight aria-hidden className="ltr:-scale-x-100" />
                {s.prev}
              </Link>
            </Button>
            <span className="text-muted-foreground text-sm">
              {s.pageOf.replace("{p}", nf.format(f.page)).replace("{n}", nf.format(list.pages))}
            </span>
            <Button asChild variant="outline" size="sm" className={f.page >= list.pages ? "invisible" : ""}>
              <Link href={hrefWith(f, f.page + 1)} rel="next">
                {s.next}
                <ChevronLeft aria-hidden className="ltr:-scale-x-100" />
              </Link>
            </Button>
          </nav>
        )}
      </section>
      <p className="text-muted-foreground text-xs">{s.footnote}</p>
    </div>
  );
}
