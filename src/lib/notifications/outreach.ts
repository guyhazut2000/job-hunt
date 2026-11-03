import { db } from "@/lib/db";
import { DEFAULT_PREFS, followUpDedupeKey, followUpDue } from "@/lib/outreach/assistant";
import { fillO, outreachAssistantStrings } from "@/lib/i18n/outreach-assistant";
import { notify } from "./create";

const DAY = 86_400_000;

/**
 * Outreach follow-up reminders (#86): a contact accepted the request, or hasn't answered after the
 * user's follow-up delay. One reminder per contact + step (dedupe key), via the normal notification
 * channels. The reminder only links to a ready draft — nothing is sent to LinkedIn.
 */
export async function runOutreachFollowUps(now = new Date()): Promise<{ reminded: number }> {
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
  for (const c of contacts) {
    const due = followUpDue(c, c.user.outreachPrefs?.followUpDays ?? DEFAULT_PREFS.followUpDays, now);
    if (!due) continue;
    const s = outreachAssistantStrings[c.user.locale === "en" ? "en" : "he"];
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
  return { reminded };
}
