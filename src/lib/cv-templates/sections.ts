/**
 * CV sections and per-template layout (order, visibility, renamed titles). Pure; shared by the
 * editor, the HTML preview and the PDF/DOCX renderers. See docs/cv-templates.md.
 */
import { z } from "zod";

export const BUILTIN_SECTIONS = [
  "summary",
  "experience",
  "projects",
  "education",
  "skills",
  "languages",
  "military",
  "volunteering",
  "links",
] as const;
export type BuiltinSection = (typeof BUILTIN_SECTIONS)[number];
/** Built-in id, or `custom:<id>` for a profile custom section. */
export type SectionId = BuiltinSection | `custom:${string}`;

export const isBuiltin = (id: string): id is BuiltinSection => (BUILTIN_SECTIONS as readonly string[]).includes(id);
export const customId = (id: string) => `custom:${id}` as const;

const title = z.string().trim().max(60);
export const layoutEntry = z.object({
  id: z
    .string()
    .regex(
      /^(summary|experience|projects|education|skills|languages|military|volunteering|links|custom:[a-z0-9]{1,24})$/,
    ),
  visible: z.boolean().default(true),
  /** User-renamed heading per export language; empty → the template's default label. */
  titles: z.object({ he: title.optional(), en: title.optional() }).default({}),
});
export type LayoutEntry = { id: SectionId; visible: boolean; titles: { he?: string; en?: string } };
export const layoutSchema = z.array(layoutEntry).max(BUILTIN_SECTIONS.length + 6);

/**
 * Reconcile a saved layout with the template defaults and the profile's current custom sections:
 * keeps the saved order and choices, drops unknown/duplicate/removed ids, and appends anything new
 * (new built-ins at their default position relative order, new custom sections visible at the end).
 */
export function normalizeLayout(
  saved: unknown,
  defaults: readonly BuiltinSection[],
  customIds: readonly string[],
): LayoutEntry[] {
  const parsed = layoutSchema.safeParse(saved);
  const rows = parsed.success ? parsed.data : [];
  const allowed = new Set<string>([...BUILTIN_SECTIONS, ...customIds.map(customId)]);
  const seen = new Set<string>();
  const out: LayoutEntry[] = [];
  for (const r of rows) {
    if (!allowed.has(r.id) || seen.has(r.id)) continue;
    seen.add(r.id);
    const titles: LayoutEntry["titles"] = {};
    if (r.titles.he) titles.he = r.titles.he;
    if (r.titles.en) titles.en = r.titles.en;
    out.push({ id: r.id as SectionId, visible: r.visible, titles });
  }
  const order = [...defaults, ...BUILTIN_SECTIONS.filter((b) => !defaults.includes(b))];
  for (const id of order) {
    if (seen.has(id)) continue;
    // Insert after the closest preceding default that is already placed, so a new section lands
    // where the template expects it instead of always at the bottom.
    const prev = order
      .slice(0, order.indexOf(id))
      .reverse()
      .find((p) => seen.has(p));
    const at = prev ? out.findIndex((e) => e.id === prev) + 1 : 0;
    out.splice(at, 0, { id, visible: defaults.includes(id), titles: {} });
    seen.add(id);
  }
  for (const c of customIds) {
    const id = customId(c);
    if (!seen.has(id)) {
      out.push({ id, visible: true, titles: {} });
      seen.add(id);
    }
  }
  return out;
}

export function defaultLayout(defaults: readonly BuiltinSection[], customIds: readonly string[]): LayoutEntry[] {
  return normalizeLayout([], defaults, customIds);
}

/** Move one entry (keyboard/touch fallback for drag and drop). */
export function moveEntry<X>(list: X[], from: number, to: number): X[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}
