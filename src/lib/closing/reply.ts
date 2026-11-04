import type { OfferInput } from "@/lib/offers/calc";
import { SOURCES, type Lang, type Source } from "./checklist";

/**
 * Offer reply builder (#119): a copy-only acceptance or counter-offer email built from the saved offer (#offers)
 * and the user's own asks. It never sends anything and never invents numbers: every figure comes from the offer
 * the user entered, every justification is the user's own text, and anything missing stays a [placeholder].
 * Both modes ask the employer to confirm the terms in writing, listing the items the Notice to Employee
 * (Terms of Employment) Law, 2002, section 2, requires (per Kol Zchut's summary of the law).
 */

type T = Record<Lang, string>;

/** Section 2 items of the Notice to Employee (Terms of Employment) Law, 2002 — as summarised by Kol Zchut. */
export const WRITTEN_TERMS: { id: string; label: T }[] = [
  { id: "parties", label: { he: "זהות המעסיק והעובד", en: "Who the employer and the employee are" } },
  {
    id: "start",
    label: {
      he: "תאריך תחילת העבודה, ואם החוזה לתקופה קצובה – משך התקופה",
      en: "The start date, and the length of the term if the contract is fixed-term",
    },
  },
  { id: "duties", label: { he: "תיאור התפקיד העיקרי", en: "The main job duties" } },
  { id: "manager", label: { he: "שם או תפקיד הממונה הישיר", en: "The name or title of my direct manager" } },
  { id: "pay", label: { he: "סך השכר ומועדי תשלומו", en: "Total pay and when it is paid" } },
  { id: "basis", label: { he: "בסיס השכר (חודשי / שעתי וכו')", en: "The pay basis (monthly, hourly, etc.)" } },
  { id: "inKind", label: { he: "תשלומים בשווה כסף, אם יש", en: "Any pay in kind" } },
  { id: "hours", label: { he: "אורך יום העבודה או שבוע העבודה הרגיל", en: "The normal workday or workweek" } },
  { id: "rest", label: { he: "יום המנוחה השבועי", en: "The weekly rest day" } },
  {
    id: "social",
    label: {
      he: "סוגי התשלומים לתנאים סוציאליים (מעסיק ועובד) והגופים שאליהם הם מועברים",
      en: "Social-benefit payments (employer and employee) and the funds they are paid to",
    },
  },
  {
    id: "union",
    label: {
      he: "הסכם קיבוצי, אם חל – שם הארגון וכתובתו",
      en: "A collective agreement, if one applies — the union's name and address",
    },
  },
];

export const REPLY_SOURCES: Source[] = [
  SOURCES.termsLaw,
  SOURCES.terms,
  {
    label: { he: "Tech Interview Handbook: משא ומתן על הצעה", en: "Tech Interview Handbook: negotiating an offer" },
    url: "https://www.techinterviewhandbook.org/negotiation/",
  },
];

export const ASK_KINDS = ["base", "signing", "equity", "remote", "start", "other"] as const;
export type AskKind = (typeof ASK_KINDS)[number];
export interface CounterAsk {
  kind: AskKind;
  /** What the user asks for, in their own words ("₪34,000 gross", "2 more remote days"). */
  target: string;
  /** The user's own justification. Empty = no justification line. */
  why: string;
}
export const MAX_ASKS = 4;

export const ASK_LABEL: Record<AskKind, T> = {
  base: { he: "שכר בסיס", en: "Base salary" },
  signing: { he: "מענק חתימה", en: "Signing bonus" },
  equity: { he: "אופציות / מניות", en: "Equity" },
  remote: { he: "ימי עבודה מהבית", en: "Remote days" },
  start: { he: "תאריך התחלה", en: "Start date" },
  other: { he: "אחר", en: "Other" },
};

const money = (n: number, lang: Lang) => `₪${Math.round(n).toLocaleString(lang === "he" ? "he-IL" : "en-US")}`;
const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const nm = (s: string | null | undefined, fb: string) => clean(s) || fb;

/** The offer's terms as the user entered them; only filled (non-zero) values, nothing assumed. */
export function offerTermLines(o: Partial<OfferInput> | null | undefined, lang: Lang): string[] {
  if (!o) return [];
  const he = lang === "he";
  const out: string[] = [];
  if (o.baseMonthly)
    out.push(
      he
        ? `שכר בסיס: ${money(o.baseMonthly, lang)} ברוטו לחודש`
        : `Base salary: ${money(o.baseMonthly, lang)} gross per month`,
    );
  if (o.bonusAnnual)
    out.push(
      he ? `בונוס שנתי צפוי: ${money(o.bonusAnnual, lang)}` : `Expected annual bonus: ${money(o.bonusAnnual, lang)}`,
    );
  if (o.signingBonus)
    out.push(he ? `מענק חתימה: ${money(o.signingBonus, lang)}` : `Signing bonus: ${money(o.signingBonus, lang)}`);
  if (o.equityUnits)
    out.push(
      he
        ? `אופציות / מניות: ${o.equityUnits.toLocaleString("he-IL")} יחידות, הבשלה על פני ${o.vestingYears ?? "[?]"} שנים`
        : `Equity: ${o.equityUnits.toLocaleString("en-US")} units vesting over ${o.vestingYears ?? "[?]"} years`,
    );
  if (o.pensionEmployerPct || o.severancePct)
    out.push(
      he
        ? `פנסיה: הפרשת מעסיק ${o.pensionEmployerPct ?? 0}% + פיצויים ${o.severancePct ?? 0}%`
        : `Pension: employer ${o.pensionEmployerPct ?? 0}% + severance ${o.severancePct ?? 0}%`,
    );
  if (o.khEmployerPct)
    out.push(
      he
        ? `קרן השתלמות: הפרשת מעסיק ${o.khEmployerPct}%${o.khOnFullSalary ? " על השכר המלא" : ""}`
        : `Keren hishtalmut: employer ${o.khEmployerPct}%${o.khOnFullSalary ? " on the full salary" : ""}`,
    );
  if (o.remoteDaysPerWeek)
    out.push(he ? `עבודה מהבית: ${o.remoteDaysPerWeek} ימים בשבוע` : `Remote work: ${o.remoteDaysPerWeek} days a week`);
  if (o.carBenefitMonthly) out.push(he ? "רכב חברה" : "Company car");
  if (o.mealsMonthly)
    out.push(
      he ? `כרטיס ארוחות: ${money(o.mealsMonthly, lang)} לחודש` : `Meal card: ${money(o.mealsMonthly, lang)} per month`,
    );
  return out;
}

export interface ReplyInput {
  mode: "accept" | "counter";
  company: string;
  role: string;
  myName?: string | null;
  recruiter?: string | null;
  offer?: Partial<OfferInput> | null;
  /** Desired start date (yyyy-mm-dd or free text) — optional. */
  startDate?: string | null;
  asks?: CounterAsk[];
}

/** Asks with a target; blank ones are dropped, max MAX_ASKS. */
export function cleanAsks(asks: CounterAsk[] | undefined): CounterAsk[] {
  return (asks ?? [])
    .map((a) => ({
      kind: (ASK_KINDS as readonly string[]).includes(a.kind) ? a.kind : "other",
      target: clean(a.target).slice(0, 200),
      why: clean(a.why).slice(0, 400),
    }))
    .filter((a) => a.target)
    .slice(0, MAX_ASKS);
}

const stop = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

export function offerReplyDraft(p: ReplyInput, lang: Lang): string {
  const he = lang === "he";
  const me = nm(p.myName, he ? "[השם שלך]" : "[your name]");
  const hi = clean(p.recruiter)
    ? he
      ? `שלום ${clean(p.recruiter)},`
      : `Hi ${clean(p.recruiter)},`
    : he
      ? "שלום,"
      : "Hello,";
  const role = nm(p.role, he ? "[התפקיד]" : "[role]");
  const company = nm(p.company, he ? "[החברה]" : "[company]");
  const terms = offerTermLines(p.offer, lang);
  const asks = cleanAsks(p.asks);
  const counter = p.mode === "counter" && asks.length > 0;
  const lines: string[] = [hi];

  if (!counter) {
    lines.push(
      he
        ? `תודה רבה על ההצעה לתפקיד ${role} ב-${company}. אני שמח/ה לאשר שאני מקבל/ת אותה.`
        : `Thank you for the offer for the ${role} role at ${company}. I'm happy to confirm that I accept.`,
    );
    if (terms.length) {
      lines.push(
        "",
        he
          ? "כדי שנהיה מתואמים, אלה התנאים כפי שהבנתי אותם:"
          : "So we're aligned, these are the terms as I understood them:",
      );
      lines.push(...terms.map((t) => `- ${t}`));
    }
  } else {
    lines.push(
      he
        ? `תודה רבה על ההצעה לתפקיד ${role} ב-${company}. אני מאוד רוצה להצטרף, ולפני שאחתום אשמח לדבר על כמה נקודות:`
        : `Thank you for the offer for the ${role} role at ${company}. I'm excited about joining, and before I sign I'd like to discuss a few points:`,
    );
    for (const a of asks) {
      const label = ASK_LABEL[a.kind][lang];
      const why = a.why ? (he ? ` – ${stop(a.why)}` : ` — ${stop(a.why)}`) : "";
      lines.push(`- ${label}: ${a.target}${why}`);
    }
    if (terms.length) {
      lines.push(
        "",
        he
          ? "לשם הסדר, אלה התנאים בהצעה הנוכחית כפי שהבנתי אותם:"
          : "For reference, the current offer as I understood it:",
      );
      lines.push(...terms.map((t) => `- ${t}`));
    }
    lines.push(
      "",
      he
        ? "אם נוכל להגיע להסכמה על הנקודות האלה, אני מוכן/ה להתקדם ולחתום."
        : "If we can agree on these points, I'm ready to move forward and sign.",
    );
  }
  if (clean(p.startDate))
    lines.push(
      he
        ? `תאריך ההתחלה שמתאים לי: ${clean(p.startDate)}.`
        : `The start date that works for me: ${clean(p.startDate)}.`,
    );

  lines.push(
    "",
    he
      ? "אשמח לקבל את התנאים הסופיים בכתב (בחוזה או בהודעה על תנאי העבודה), כולל:"
      : "Could you please send the final terms in writing (in the contract or a written terms notice), including:",
  );
  lines.push(...WRITTEN_TERMS.map((t) => `- ${t.label[lang]}`));
  lines.push("", he ? "תודה רבה," : "Thank you,", me);
  return lines.join("\n");
}
