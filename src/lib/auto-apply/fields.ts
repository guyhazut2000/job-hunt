/**
 * Form mapping for auto-apply: ATS question JSON → fields, profile prefill, user edits,
 * and the documented submit bodies. No network and no secrets.
 */
import { z } from "zod";
import { DOCUMENT_TYPES, type DocumentTypeKey } from "@/lib/documents/constants";
import type { AttachableDocument } from "@/lib/documents/picker";
import {
  blankField,
  FIELD_KINDS,
  FIELD_SOURCES,
  hasValue,
  parseMulti,
  type ApplyField,
  type ApplyProfile,
  type FieldKind,
  type PacketDocument,
  type SentSnapshot,
} from "./types";

const SENSITIVE =
  /visa|sponsor|authori[sz]ed to work|work authori|citizen|citizenship|disability|veteran|gender|race|ethnic|religion|criminal|felony|eeoc|demographic|pronoun|sexual orientation|marital|date of birth|\bage\b|אזרח|ויזה|חסות|נכות|מין|דת|גזע|עבר פלילי|מצב משפחתי|תאריך לידה/i;

export function isSensitiveLabel(label: string): boolean {
  return SENSITIVE.test(label);
}

export function profilePacket(): ApplyField[] {
  return [
    blankField({ id: "first_name", label: "First name", required: true }),
    blankField({ id: "last_name", label: "Last name", required: true }),
    blankField({ id: "email", label: "Email", required: true }),
    blankField({ id: "phone", label: "Phone" }),
    blankField({ id: "location", label: "Location", transmit: false }),
    blankField({ id: "linkedin", label: "LinkedIn" }),
    blankField({ id: "github", label: "GitHub" }),
    blankField({ id: "portfolio", label: "Portfolio" }),
    blankField({ id: "resume", label: "Resume", kind: "file" }),
    blankField({ id: "cover_letter", label: "Cover letter", kind: "file" }),
  ];
}

/** Lever's documented standard apply fields. Custom questions are not in the public API. */
export function leverPacket(): ApplyField[] {
  return [
    blankField({ id: "name", label: "Full name", required: true }),
    blankField({ id: "email", label: "Email", required: true }),
    blankField({ id: "phone", label: "Phone" }),
    blankField({ id: "org", label: "Current company" }),
    blankField({ id: "urls.LinkedIn", label: "LinkedIn" }),
    blankField({ id: "urls.GitHub", label: "GitHub" }),
    blankField({ id: "urls.Portfolio", label: "Portfolio" }),
    blankField({ id: "resume", label: "Resume", kind: "file" }),
    blankField({ id: "comments", label: "Comments", kind: "long" }),
  ];
}

interface GhField {
  name?: string;
  type?: string;
  values?: { value?: string | number; label?: string }[];
}
interface GhQuestion {
  required?: boolean;
  label?: string;
  fields?: GhField[];
}

function optionsOf(values: GhField["values"]): { value: string; label: string }[] {
  return (values ?? [])
    .filter((v) => v.value != null && v.label != null)
    .map((v) => ({ value: String(v.value), label: String(v.label) }));
}

function kindOf(type: string | undefined): FieldKind | "hidden" {
  switch (type) {
    case "input_hidden":
      return "hidden";
    case "textarea":
      return "long";
    case "input_file":
      return "file";
    case "multi_value_single_select":
      return "select";
    case "multi_value_multi_select":
      return "multi";
    default:
      return "text";
  }
}

function pushQuestion(out: ApplyField[], question: GhQuestion, group: "question" | "compliance" | "demographic") {
  const visible = (question.fields ?? []).filter((f) => f.name && kindOf(f.type) !== "hidden");
  const file = visible.find((f) => f.type === "input_file");
  const chosen = file ?? visible.find((f) => f.type !== "textarea") ?? visible[0];
  if (!chosen?.name) return;
  const label = question.label?.trim() || chosen.name;
  const sensitive = group !== "question" || isSensitiveLabel(label);
  const location = chosen.name === "location" || /^(location|city|address)$/i.test(label);
  out.push(
    blankField({
      id: chosen.name,
      label,
      kind: kindOf(chosen.type) === "hidden" ? "text" : (kindOf(chosen.type) as FieldKind),
      required: question.required === true,
      options: optionsOf(chosen.values),
      sensitive,
      transmit: group === "question" && !location,
    }),
  );
}

function asQuestions(raw: unknown): GhQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((q): q is GhQuestion => !!q && typeof q === "object" && Array.isArray((q as GhQuestion).fields));
}

/** Greenhouse `GET .../jobs/{id}?questions=true` body. Drops hidden lat/long and the resume textarea twin. */
export function parseGreenhouseForm(body: unknown): ApplyField[] {
  const root = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const out: ApplyField[] = [];
  for (const q of asQuestions(root.questions)) pushQuestion(out, q, "question");
  for (const q of asQuestions(root.location_questions)) pushQuestion(out, q, "question");
  for (const q of asQuestions(root.compliance)) pushQuestion(out, q, "compliance");
  const demo = root.demographic_questions;
  if (demo && typeof demo === "object" && Array.isArray((demo as { questions?: unknown }).questions)) {
    for (const q of (demo as { questions: Record<string, unknown>[] }).questions) {
      const options = Array.isArray(q.answer_options)
        ? (q.answer_options as { id?: string | number; label?: string }[])
            .filter((o) => o.id != null && o.label)
            .map((o) => ({ value: String(o.id), label: String(o.label) }))
        : [];
      out.push(
        blankField({
          id: `demographic_${String(q.id ?? out.length)}`,
          label: String(q.label ?? "Demographic question"),
          kind: q.type === "multi_value_multi_select" ? "multi" : "select",
          required: q.required === true,
          options,
          sensitive: true,
          transmit: false,
        }),
      );
    }
  }
  return out;
}

interface AshbyEntry {
  isRequired?: boolean;
  field?: {
    path?: string;
    title?: string;
    type?: string;
    selectableValues?: { label?: string; value?: string }[] | null;
  };
}

function ashbyEntries(definition: unknown): AshbyEntry[] {
  if (!definition || typeof definition !== "object") return [];
  const body = definition as { fields?: unknown; sections?: { fields?: unknown }[] };
  const direct = Array.isArray(body.fields) ? (body.fields as AshbyEntry[]) : [];
  const nested = (body.sections ?? []).flatMap((s) => (Array.isArray(s.fields) ? (s.fields as AshbyEntry[]) : []));
  return [...direct, ...nested];
}

function ashbyKind(type: string | undefined): FieldKind {
  switch (type) {
    case "LongText":
      return "long";
    case "File":
      return "file";
    case "ValueSelect":
      return "select";
    case "MultiValueSelect":
      return "multi";
    case "Boolean":
      return "boolean";
    case "Number":
    case "Score":
      return "number";
    default:
      return "text";
  }
}

/** Ashby `applicationFormDefinition` (sections[].fields[] or fields[]). Returns null when nothing usable is there. */
export function parseAshbyForm(definition: unknown): ApplyField[] | null {
  const entries = ashbyEntries(definition).filter((e) => e.field?.path && e.field.title);
  if (!entries.length) return null;
  return entries.map((e) => {
    const field = e.field!;
    const label = field.title!.trim();
    const kind = ashbyKind(field.type);
    const sensitive = isSensitiveLabel(label);
    return blankField({
      id: field.path!,
      label,
      kind,
      required: e.isRequired === true,
      options: (field.selectableValues ?? [])
        .filter((o) => o.value && o.label)
        .map((o) => ({ value: String(o.value), label: String(o.label) })),
      sensitive,
      transmit: true,
    });
  });
}

export function splitName(name: string | null): { first: string; last: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0]!, last: "" };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

function hebrew(label: string): boolean {
  return /[\u0590-\u05FF]/.test(label);
}

function salaryText(profile: ApplyProfile, label: string): string {
  const { salaryMin: min, salaryMax: max } = profile;
  if (min == null && max == null) return "";
  const he = hebrew(label);
  const unit = he ? "ש״ח ברוטו לחודש" : "ILS gross per month";
  const fmt = (n: number) => n.toLocaleString("en-US");
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)} ${unit}`;
  if (min != null) return `${fmt(min)}+ ${unit}`;
  return `${he ? "עד" : "up to"} ${fmt(max!)} ${unit}`;
}

function availabilityText(profile: ApplyProfile, label: string): string {
  const he = hebrew(label);
  if (profile.availability === "ACTIVE") return he ? "זמינות מיידית" : "Available to start immediately";
  if (profile.availability === "OPEN") return he ? "זמינות בהתראה קצרה" : "Available with a short notice";
  return "";
}

function yearsFor(label: string, profile: ApplyProfile): number | null {
  const hay = label.toLowerCase();
  const hits = profile.skills.filter(
    (s) => s.years != null && s.name.length >= 2 && hay.includes(s.name.toLowerCase()),
  );
  hits.sort((a, b) => b.name.length - a.name.length);
  return hits[0]?.years ?? null;
}

function looksLike(id: string, label: string, patterns: RegExp[]): boolean {
  const hay = `${id} ${label}`.toLowerCase();
  return patterns.some((p) => p.test(hay));
}

function fill(field: ApplyField, value: string, flagReason?: ApplyField["flagReason"]): ApplyField {
  if (!value.trim()) return field;
  return {
    ...field,
    value,
    source: "profile",
    confidence: flagReason ? "low" : "high",
    flagged: Boolean(flagReason),
    flagReason,
  };
}

/** Deterministic answers from the profile. Sensitive questions stay blank. */
export function mapProfile(fields: ApplyField[], profile: ApplyProfile): ApplyField[] {
  const name = splitName(profile.name);
  return fields.map((field) => {
    if (field.sensitive) {
      return field.required ? { ...field, flagged: true, flagReason: "sensitive" } : field;
    }
    if (field.kind === "file") return field;
    const id = field.id.toLowerCase();
    const label = field.label;
    if (looksLike(id, label, [/first[_\s-]?name/, /שם פרטי/, /^given/])) return fill(field, name.first);
    if (looksLike(id, label, [/last[_\s-]?name/, /שם משפחה/, /surname/, /family/])) return fill(field, name.last);
    const labelIsName = label.trim().toLowerCase() === "name" || label.trim() === "שם" || label.trim() === "שם מלא";
    if (
      id === "name" ||
      id.endsWith("_systemfield_name") ||
      labelIsName ||
      looksLike(id, label, [/full[_\s-]?name/, /שם מלא/])
    ) {
      return fill(field, [name.first, name.last].filter(Boolean).join(" "));
    }
    if (looksLike(id, label, [/e-?mail/, /אימייל/, /דוא"?ל/])) return fill(field, profile.email);
    if (looksLike(id, label, [/phone|mobile|טלפון/, /^tel$/])) return fill(field, profile.phone);
    if (looksLike(id, label, [/linkedin/, /לינקדאין/])) return fill(field, profile.linkedinUrl);
    if (looksLike(id, label, [/github/, /גיטהאב/])) return fill(field, profile.githubUrl);
    if (looksLike(id, label, [/portfolio|website|personal site|אתר/])) return fill(field, profile.portfolioUrl);
    if (looksLike(id, label, [/current company|^org$|employer|חברה נוכחית/]))
      return fill(field, profile.currentCompany);
    if (id === "location" || (!field.transmit && looksLike(id, label, [/location|city|address|עיר|כתובת/]))) {
      return fill(field, profile.location, "location");
    }
    if (looksLike(id, label, [/salary|compensation|pay expectation|expected pay|שכר/])) {
      return fill(field, salaryText(profile, label));
    }
    if (looksLike(id, label, [/available|start date|notice period|זמינות/])) {
      return fill(field, availabilityText(profile, label));
    }
    if (looksLike(id, label, [/years?|שנות ניסיון|כמה שנות/])) {
      const years =
        yearsFor(label, profile) ??
        (looksLike(id, label, [/total|overall|סה"כ|ניסיון כולל/]) ? profile.yearsExperience : null);
      if (years != null) return fill(field, String(years));
    }
    return field;
  });
}

const FILE_TYPE: { type: DocumentTypeKey; test: RegExp }[] = [
  { type: "COVER_LETTER", test: /cover|מכתב מקדים/i },
  { type: "TRANSCRIPT", test: /transcript|גיליון/i },
  { type: "PORTFOLIO", test: /portfolio|תיק עבודות/i },
  { type: "CV", test: /resume|cv|קורות/i },
];

function wantedType(field: ApplyField): DocumentTypeKey | "OTHER" {
  const hay = `${field.id} ${field.label}`;
  return FILE_TYPE.find((row) => row.test.test(hay))?.type ?? "OTHER";
}

/** Bind selected document refs onto file fields. Other fields are left alone. */
export function attachDocuments(
  fields: ApplyField[],
  refs: readonly string[],
  docs: readonly AttachableDocument[],
): ApplyField[] {
  const selected = docs.filter((d) => refs.includes(d.ref) && !d.expired);
  const used = new Set<string>();
  const take = (type: DocumentTypeKey | "OTHER"): AttachableDocument | undefined => {
    const hit =
      type === "OTHER"
        ? selected.find((d) => !used.has(d.ref))
        : selected.find((d) => d.type === type && !used.has(d.ref));
    if (hit) used.add(hit.ref);
    return hit;
  };
  return fields.map((field) => {
    if (field.kind !== "file") return field;
    const hit = take(wantedType(field));
    if (!hit) {
      return field.required
        ? {
            ...field,
            value: "",
            source: "blank",
            flagged: true,
            flagReason: "manual" as const,
            confidence: "low" as const,
          }
        : { ...field, value: "", source: "blank" as const, flagged: false, flagReason: undefined };
    }
    return { ...field, value: hit.ref, source: "user", flagged: false, flagReason: undefined, confidence: "high" };
  });
}

export function packetDocuments(refs: readonly string[], docs: readonly AttachableDocument[]): PacketDocument[] {
  const allow = new Set(refs);
  return docs
    .filter((d) => allow.has(d.ref))
    .map((d) => ({ ref: d.ref, title: d.title, fileName: d.fileName, type: d.type }));
}

/** Posted form values. A posted value is the user confirming it. Invalid options are dropped and flagged. */
export function applyUserEdits(fields: ApplyField[], values: Record<string, string>): ApplyField[] {
  return fields.map((field) => {
    if (field.kind === "file" || !(field.id in values)) return field;
    let value = values[field.id]!.slice(0, 4000);
    if (field.kind === "select" && value && !field.options.some((o) => o.value === value)) {
      return { ...field, value: "", source: "user", flagged: true, flagReason: "unmatched_option", confidence: "low" };
    }
    if (field.kind === "multi") {
      const picked = parseMulti(value).filter((v) => field.options.some((o) => o.value === v));
      if (parseMulti(value).length > 0 && picked.length === 0) {
        return {
          ...field,
          value: "[]",
          source: "user",
          flagged: true,
          flagReason: "unmatched_option",
          confidence: "low",
        };
      }
      value = JSON.stringify(picked);
    }
    const next = { ...field, value, source: "user" as const };
    if (!field.transmit) {
      return { ...next, flagged: true, flagReason: field.flagReason ?? "location", confidence: "low" };
    }
    if (!hasValue(next)) {
      return next.required
        ? { ...next, flagged: true, flagReason: field.sensitive ? "sensitive" : "manual", confidence: "low" }
        : { ...next, flagged: false, flagReason: undefined, confidence: "low" };
    }
    return { ...next, flagged: false, flagReason: undefined, confidence: "high" };
  });
}

export function editsFromForm(form: FormData, fields: readonly ApplyField[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fields) {
    if (field.kind === "file") continue;
    if (field.kind === "multi") {
      out[field.id] = JSON.stringify(
        form
          .getAll(`field:${field.id}`)
          .map((v) => String(v))
          .filter(Boolean),
      );
    } else if (field.kind === "boolean") {
      out[field.id] =
        form.get(`field:${field.id}`) === "on" || form.get(`field:${field.id}`) === "true" ? "true" : "false";
    } else {
      out[field.id] = String(form.get(`field:${field.id}`) ?? "");
    }
  }
  return out;
}

export type ApproveBlock = "needs_input" | "confirm_flags";

/** Empty required fields block approval. Flagged required fields need an explicit confirm. */
export function approveBlock(fields: readonly ApplyField[], confirmFlags: boolean): ApproveBlock | null {
  if (fields.some((f) => f.required && !hasValue(f))) return "needs_input";
  if (fields.some((f) => f.required && (f.flagged || !f.transmit)) && !confirmFlags) return "confirm_flags";
  return null;
}

/** API submit cannot carry a required field we would omit or that the user has not confirmed. */
export function apiBlocked(fields: readonly ApplyField[]): boolean {
  return fields.some((f) => f.required && (!f.transmit || f.flagged || !hasValue(f)));
}

export function draftStatus(fields: readonly ApplyField[], manual: boolean): "MANUAL" | "NEEDS_INPUT" | "READY" {
  if (manual) return "MANUAL";
  return fields.some((f) => f.required && !hasValue(f)) ? "NEEDS_INPUT" : "READY";
}

export function sentSnapshot(input: {
  delivery: SentSnapshot["delivery"];
  platform: string;
  reason: string;
  fields: readonly ApplyField[];
  documents: PacketDocument[];
  recordedAt: string;
}): SentSnapshot {
  return {
    delivery: input.delivery,
    platform: input.platform,
    reason: input.reason,
    recordedAt: input.recordedAt,
    fields: input.fields.filter((f) => f.kind !== "file").map((f) => ({ id: f.id, label: f.label, value: f.value })),
    documents: input.documents.map((d) => ({ ref: d.ref, title: d.title, fileName: d.fileName, type: d.type })),
  };
}

export interface ResumePayload {
  filename: string;
  base64: string;
}

/** Greenhouse JSON body. Location is omitted (it is ignored without lat/long). Demographics are omitted. */
export function greenhouseBody(
  fields: readonly ApplyField[],
  files: Readonly<Record<string, ResumePayload>> = {},
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const field of fields) {
    if (!field.transmit || (field.sensitive && !hasValue(field))) continue;
    if (field.kind === "file") {
      const file = files[field.id];
      if (!file) continue;
      const content =
        field.id === "resume"
          ? "resume_content"
          : field.id === "cover_letter"
            ? "cover_letter_content"
            : `${field.id}_content`;
      const filename = content.replace(/_content$/, "_content_filename");
      body[content] = file.base64;
      body[filename] = file.filename;
      continue;
    }
    if (!hasValue(field)) continue;
    if (field.kind === "multi") body[field.id] = parseMulti(field.value);
    else if (field.kind === "boolean") body[field.id] = field.value === "true";
    else if (field.kind === "number") {
      const n = Number(field.value);
      if (Number.isFinite(n)) body[field.id] = n;
    } else body[field.id] = field.value;
  }
  return body;
}

export interface AshbyFilePart {
  part: string;
  fieldId: string;
}

/** Ashby multipart pieces. File field values are the part name, matching the documented form. */
export function ashbySubmission(fields: readonly ApplyField[]): {
  submissions: { path: string; value: unknown }[];
  files: AshbyFilePart[];
} {
  const submissions: { path: string; value: unknown }[] = [];
  const files: AshbyFilePart[] = [];
  let n = 0;
  for (const field of fields) {
    if (!field.transmit || !hasValue(field)) continue;
    if (field.kind === "file") {
      n += 1;
      const part = `file_${n}`;
      files.push({ part, fieldId: field.id });
      submissions.push({ path: field.id, value: part });
      continue;
    }
    if (field.kind === "multi") submissions.push({ path: field.id, value: parseMulti(field.value) });
    else if (field.kind === "boolean") submissions.push({ path: field.id, value: field.value === "true" });
    else if (field.kind === "number") {
      const num = Number(field.value);
      if (Number.isFinite(num)) submissions.push({ path: field.id, value: num });
    } else submissions.push({ path: field.id, value: field.value });
  }
  return { submissions, files };
}

const storedField = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(FIELD_KINDS),
  required: z.boolean(),
  options: z.array(z.object({ value: z.string(), label: z.string() })),
  value: z.string(),
  source: z.enum(FIELD_SOURCES),
  confidence: z.enum(["high", "low"]),
  flagged: z.boolean(),
  flagReason: z.enum(["manual", "sensitive", "low_confidence", "unmatched_option", "location"]).optional(),
  sensitive: z.boolean(),
  transmit: z.boolean(),
});

export function readStoredFields(raw: unknown): ApplyField[] {
  const parsed = z.array(storedField).safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export function readStoredDocs(raw: unknown): PacketDocument[] {
  const parsed = z
    .array(z.object({ ref: z.string(), title: z.string(), fileName: z.string(), type: z.enum(DOCUMENT_TYPES) }))
    .safeParse(raw);
  return parsed.success ? parsed.data : [];
}

/** A JSON-safe clone Prisma can store. Callers cast to `InputJsonValue`. */
export function jsonValue(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}
