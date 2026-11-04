import { db } from "@/lib/db";
import { suggesterId } from "@/lib/discovery/suggestion-status";
import { USER_SOURCE } from "@/lib/discovery/suggest";
import type { Locale } from "@/lib/i18n/dictionaries";
import { fill, notificationStrings } from "@/lib/i18n/notifications";
import { notify } from "./create";

export type SuggestionOutcome = "ADDED" | "REJECTED";

/** Pure: the message for the user who suggested the company. */
export function buildSuggestionAlert(
  locale: Locale,
  c: { name: string; status: string; company?: { slug: string } | null },
): { outcome: SuggestionOutcome; title: string; body: string; url: string } | null {
  const s = notificationStrings(locale);
  if ((c.status === "ADDED" || c.status === "DUPLICATE") && c.company) {
    return {
      outcome: "ADDED",
      title: fill(s.suggestAddedTitle, { company: c.name }),
      body: s.suggestAddedBody,
      url: `/companies/${c.company.slug}`,
    };
  }
  if (c.status === "REJECTED") {
    return {
      outcome: "REJECTED",
      title: fill(s.suggestRejectedTitle, { company: c.name }),
      body: s.suggestRejectedBody,
      url: "/companies#my-suggestions",
    };
  }
  return null;
}

/**
 * Tell the suggester what happened to their USER suggestion (added — automatically, as MANUAL or by an
 * admin — or rejected). No-op for other sources and still-pending candidates; deduped per outcome.
 */
export async function notifySuggestionOutcome(candidateId: string): Promise<boolean> {
  const c = await db.startupCandidate.findUnique({
    where: { id: candidateId },
    select: { id: true, name: true, status: true, source: true, sourceUrl: true, company: { select: { slug: true } } },
  });
  if (!c || c.source !== USER_SOURCE) return false;
  const userId = suggesterId(c.sourceUrl);
  if (!userId) return false;
  const user = await db.user.findUnique({ where: { id: userId }, select: { locale: true } });
  if (!user) return false;
  const msg = buildSuggestionAlert(user.locale === "en" ? "en" : "he", c);
  if (!msg) return false;
  const { outcome, ...n } = msg;
  const created = await notify(userId, {
    kind: "COMPANY_SUGGESTION",
    ...n,
    data: { candidateId: c.id, outcome },
    dedupeKey: `suggestion:${c.id}:${outcome}`,
  });
  return created !== null;
}
