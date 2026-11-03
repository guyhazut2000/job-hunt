import { db } from "@/lib/db";
import {
  DEFAULT_PREFS,
  followUpDedupeKey,
  followUpDue,
  statusCheckDedupeKey,
  statusCheckDue,
} from "@/lib/outreach/assistant";
import { fillO, outreachAssistantStrings } from "@/lib/i18n/outreach-assistant";
import { notify } from "./create";

const DAY = 86_400_000;

/**
 * Outreach follow-up reminders (#86): a contact accepted the request, or hasn't answered after the
 * user's follow-up delay. One reminder per contact + step (dedupe key), via the normal notification
 * channels. The reminder only links to a ready draft — nothing is sent to LinkedIn.
 */
export async function runOutreachFollowUps(now = new Date()): Promise<{ reminded: number; checks: number }> {
  const contacts = await db.contact.findMany({
    where: {
      status: { in: ["SENT", "ACCEPTED"] },
      followedUpAt: null,
      OR: [{ sentAt: { lte: new Date(now.getTime() - DAY) } }, { statusAt: { lte: new Date(now.getTime() - DAY) } }],
    },
    select: {
      id: true,
      userId: true,
      name: true,
      status: true,
      sentAt: true,
      statusAt: true,
      createdAt: true,
      followedUpAt: true,
      company: { select: { name: true } },
      user: { select: { locale: true, outreachPrefs: { select: { followUpDays: true } } } },
    },
    take: 2000,
  });
  let reminded = 0;
  let checks = 0;
  for (const c of contacts) {
    const followUpDays = c.user.outreachPrefs?.followUpDays ?? DEFAULT_PREFS.followUpDays;
    const s = outreachAssistantStrings[c.user.locale === "en" ? "en" : "he"];
    const due = followUpDue(c, followUpDays, now);
    if (!due) {
      // Not time to nudge yet: ask once whether the request was accepted, so the status stays current.
      const check = statusCheckDue(c, followUpDays, now);
      if (!check) continue;
      const vars = { name: c.name, company: c.company?.name ?? "", days: check.days };
      const created = await notify(
        c.userId,
        {
          kind: "FOLLOW_UP",
          title: fillO(s.notifyCheckTitle, vars),
          body: fillO(s.notifyCheck, vars),
          url: `/outreach#contact-${c.id}`,
          data: { contactId: c.id, step: "check" },
          dedupeKey: statusCheckDedupeKey(c.id, check.anchor),
        },
        { now },
      );
      if (created) checks++;
      continue;
    }
    const vars = { name: c.name, company: c.company?.name ?? "", days: due.days };
    const created = await notify(
      c.userId,
      {
        kind: "FOLLOW_UP",
        title: fillO(s.notifyTitle, vars),
        body: fillO(due.kind === "accepted" ? s.notifyAccepted : s.notifyNudge, vars),
        url: `/outreach#contact-${c.id}`,
        data: { contactId: c.id, step: due.kind },
        dedupeKey: followUpDedupeKey(c.id, due),
      },
      { now },
    );
    if (created) reminded++;
  }
  return { reminded, checks };
}
