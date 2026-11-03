import { fill, type SalaryHubStrings } from "@/lib/i18n/salary-hub";

export interface CounterInput {
  name: string;
  company: string;
  role: string;
  recruiter: string;
  offered: number;
  ask: number;
  reasons: string;
  extras: string;
  /** Free text date ("יום חמישי", "12.11"). */
  deadline: string;
}

const ils = (n: number, locale: "he" | "en") => `₪${Math.round(n).toLocaleString(locale === "he" ? "he-IL" : "en-GB")}`;

/** Reasons typed as one blob → bullet lines (split on newlines, ";" or ","). */
export function reasonLines(text: string): string[] {
  return text
    .split(/\n|;|,(?!\d)/)
    .map((l) => l.trim().replace(/^[-•*]\s*/, ""))
    .filter(Boolean)
    .slice(0, 6);
}

/** Template counter-offer (no AI, no sending). Missing fields degrade gracefully. */
export function counterOfferDraft(
  i: CounterInput,
  s: SalaryHubStrings["negotiate"]["letter"],
  locale: "he" | "en",
): string {
  const company = i.company.trim() || "…";
  const role = i.role.trim() || "…";
  const parts: string[] = [];
  parts.push(i.recruiter.trim() ? fill(s.greeting, { recruiter: i.recruiter.trim() }) : s.greetingNoName);
  parts.push(fill(s.thanks, { role, company }));
  const reasons = reasonLines(i.reasons);
  if (i.offered > 0) {
    parts.push(
      fill(s.body, { offered: ils(i.offered, locale) }) +
        (reasons.length ? "\n" + reasons.map((r) => `• ${r}`).join("\n") : ""),
    );
  } else if (reasons.length) {
    parts.push(reasons.map((r) => `• ${r}`).join("\n"));
  }
  if (i.ask > 0) parts.push(fill(s.ask, { ask: ils(i.ask, locale) }));
  if (i.extras.trim()) parts.push(fill(s.extras, { extras: i.extras.trim() }));
  parts.push(i.deadline.trim() ? fill(s.close, { deadline: i.deadline.trim() }) : s.closeNoDate);
  parts.push(fill(s.sign, { name: i.name.trim() || "…" }));
  return parts.join("\n\n");
}
