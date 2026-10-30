import { db } from "@/lib/db";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";
import { fill, notificationStrings } from "@/lib/i18n/notifications";
import { notify } from "@/lib/notifications/create";
import type { AutoChange } from "./auto-apply";

/** Pure: the bell/push text for one scan's automatic changes (null when there were none). */
export function autoChangesMessage(changes: AutoChange[], locale: Locale) {
  if (!changes.length) return null;
  const n = notificationStrings(locale);
  const status = dictionaries[locale].status;
  const lines = changes
    .slice(0, 8)
    .map((c) =>
      fill(n.emailAutoLine, { company: c.company, title: c.title, status: status[c.toStatus] ?? c.toStatus }),
    );
  if (changes.length > 8) lines.push(fill(n.matchMore, { n: changes.length - 8 }));
  const first = changes[0];
  return {
    title:
      changes.length === 1
        ? fill(n.emailAutoOne, { company: first.company, status: status[first.toStatus] ?? first.toStatus })
        : fill(n.emailAutoMany, { n: changes.length }),
    body: [...lines, n.emailAutoUndo].join("\n"),
  };
}

/** One notification per scan; the daily digest picks the same changes up via statusChangedAt. */
export async function notifyAutoChanges(userId: string, changes: AutoChange[]) {
  if (!changes.length) return null;
  const user = await db.user.findUnique({ where: { id: userId }, select: { locale: true } });
  const msg = autoChangesMessage(changes, user?.locale === "en" ? "en" : "he");
  if (!msg) return null;
  return notify(userId, {
    kind: "EMAIL_UPDATE",
    ...msg,
    url: "/dashboard",
    data: { changeIds: changes.map((c) => c.changeId) },
    dedupeKey: `email-auto:${changes[0].changeId}`,
  });
}
