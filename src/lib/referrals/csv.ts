/**
 * CSV import for referral contacts (#92). Accepts a LinkedIn "Connections.csv" export, a Google
 * Contacts export or a hand-made sheet — Hebrew or English headers. Pure; the action saves the rows.
 */

export const CSV_MAX_ROWS = 500;
export const CSV_MAX_BYTES = 512 * 1024;

export interface CsvContact {
  name: string;
  company: string;
  title: string;
  linkedinUrl: string | null;
  email: string | null;
  relationship: string;
  notes: string;
}

export interface CsvSkip {
  line: number;
  reason: "no_name" | "no_company" | "duplicate";
}

/** RFC-4180-ish parser: quoted fields, "" escapes, CRLF/LF, comma or semicolon (auto). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

type Col = "name" | "first" | "last" | "company" | "title" | "linkedin" | "email" | "relationship" | "notes";

const HEADERS: Record<Col, RegExp> = {
  first: /^(first ?name|given ?name|שם פרטי)$/i,
  last: /^(last ?name|family ?name|surname|שם משפחה)$/i,
  name: /^(name|full ?name|contact|שם|שם מלא|איש קשר)$/i,
  company: /^(company|organization( 1 -)? ?name|organization|employer|חברה|מעסיק|ארגון)$/i,
  title: /^(position|title|job ?title|role|organization( 1 -)? ?title|תפקיד)$/i,
  linkedin: /^(url|linkedin|linkedin ?url|profile|לינקדאין|פרופיל)$/i,
  email: /^(e-?mail( address)?|e-?mail 1 - value|מייל|אימייל|דוא"?ל)$/i,
  relationship: /^(relationship|how (we|i) know|connection|היכרות|קשר|מאיפה)$/i,
  notes: /^(notes?|הערות?)$/i,
};

/** Find the header row (LinkedIn exports start with a few "Notes:" lines) and map columns. */
function mapHeader(rows: string[][]): { start: number; cols: Partial<Record<Col, number>> } | null {
  for (let r = 0; r < Math.min(rows.length, 6); r++) {
    const cols: Partial<Record<Col, number>> = {};
    rows[r].forEach((h, i) => {
      const k = (Object.keys(HEADERS) as Col[]).find((c) => HEADERS[c].test(h.trim()));
      if (k && cols[k] == null) cols[k] = i;
    });
    if ((cols.name != null || cols.first != null) && cols.company != null) return { start: r + 1, cols };
  }
  return null;
}

const cell = (row: string[], i: number | undefined, max: number) => (i == null ? "" : (row[i] ?? "").trim().slice(0, max));

const linkedinOk = (u: string) => /^https:\/\/([a-z]+\.)?linkedin\.com\/in\//i.test(u);
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export function contactsFromCsv(
  text: string,
): { contacts: CsvContact[]; skipped: CsvSkip[]; error?: "no_header" | "too_big" | "too_many" } {
  if (text.length > CSV_MAX_BYTES) return { contacts: [], skipped: [], error: "too_big" };
  const rows = parseCsv(text);
  const head = mapHeader(rows);
  if (!head) return { contacts: [], skipped: [], error: "no_header" };
  const body = rows.slice(head.start);
  if (body.length > CSV_MAX_ROWS) return { contacts: [], skipped: [], error: "too_many" };
  const { cols } = head;
  const seen = new Set<string>();
  const contacts: CsvContact[] = [];
  const skipped: CsvSkip[] = [];
  body.forEach((row, idx) => {
    const line = head.start + idx + 1;
    const name = (cell(row, cols.name, 120) || `${cell(row, cols.first, 60)} ${cell(row, cols.last, 60)}`).trim();
    const company = cell(row, cols.company, 120);
    if (!name) return skipped.push({ line, reason: "no_name" });
    if (!company) return skipped.push({ line, reason: "no_company" });
    const key = `${name.toLowerCase()}|${company.toLowerCase()}`;
    if (seen.has(key)) return skipped.push({ line, reason: "duplicate" });
    seen.add(key);
    const li = cell(row, cols.linkedin, 300);
    const em = cell(row, cols.email, 200);
    contacts.push({
      name,
      company,
      title: cell(row, cols.title, 120),
      linkedinUrl: li && linkedinOk(li) ? li : null,
      email: em && emailOk(em) ? em.toLowerCase() : null,
      relationship: cell(row, cols.relationship, 200),
      notes: cell(row, cols.notes, 500),
    });
  });
  return { contacts, skipped };
}
