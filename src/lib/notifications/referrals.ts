import { db } from "@/lib/db";
import { referralDedupeKey, referralFollowUpDue } from "@/lib/referrals/followup";
import { fillRef, referralStrings } from "@/lib/i18n/referrals";
import { notify } from "./create";

/**
 * Referral follow-up reminders (#92): asked and no answer, agreed but not yet submitted, or submitted
 * with no news. One reminder per referral + status (dedupe key). Nothing is sent to the contact.
 */
export async function runReferralFollowUps(now = new Date()): Promise<{ reminded: number }> {
  const rows = await db.referral.findMany({
    where: { status: { in: ["ASKED", "AGREED", "SUBMITTED"] }, statusAt: { lte: new Date(now.getTime() - 86_400_000) } },
    select: {
      id: true,
      userId: true,
      status: true,
      statusAt: true,
      followedUpAt: true,
      contact: { select: { name: true, companyName: true, company: { select: { name: true } } } },
      application: { select: { company: true } },
      user: { select: { locale: true } },
    },
    take: 2000,
  });
  let reminded = 0;
  for (const r of rows) {
    const due = referralFollowUpDue(r, now);
    if (!due) continue;
    const s = referralStrings[r.user.locale === "en" ? "en" : "he"];
    const vars = {
      name: r.contact.name,
      company: r.application?.company ?? r.contact.company?.name ?? r.contact.companyName ?? "",
      days: due.days,
    };
    const body = due.kind === "ask_again" ? s.notifyAskAgain : due.kind === "send_cv" ? s.notifySendCv : s.notifyAskAnswer;
    const created = await notify(
      r.userId,
      {
        kind: "FOLLOW_UP",
        title: fillRef(s.notifyTitle, vars),
        body: fillRef(body, vars),
        url: `/referrals#referral-${r.id}`,
        data: { referralId: r.id, step: due.kind },
        dedupeKey: referralDedupeKey(r),
      },
      { now },
    );
    if (created) reminded++;
  }
  return { reminded };
}
