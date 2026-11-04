import { z } from "zod";
import { CONTRACT_ITEMS, ITEM_IDS, type Lang } from "./checklist";

/**
 * Optional contract-text scan. The user pastes the contract; we report, per checklist item, whether a matching
 * clause seems present and quote it VERBATIM from the pasted text. Quotes that are not an exact substring of the
 * pasted text are dropped, and AI notes may not contain numbers that are not in the quote — so nothing is invented.
 * The pasted text itself is never stored, only the result. Offline/mock/limit → keyword heuristic.
 */

export const MAX_CONTRACT_CHARS = 30_000;

export interface ScanItem {
  id: string;
  found: boolean;
  quote: string | null;
  note: string | null;
}
export interface ScanResult {
  source: "ai" | "heuristic" | "limited";
  at: string;
  chars: number;
  items: ScanItem[];
}

export const scanResultSchema = z.object({
  source: z.enum(["ai", "heuristic", "limited"]),
  at: z.string(),
  chars: z.number(),
  items: z.array(
    z.object({ id: z.string(), found: z.boolean(), quote: z.string().nullable(), note: z.string().nullable() }),
  ),
});

export function parseScan(raw: unknown): ScanResult | null {
  const r = scanResultSchema.safeParse(raw);
  return r.success ? r.data : null;
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** The sentence/line around `index` in `text`, trimmed to `max` chars — always a verbatim substring. */
function snippetAround(text: string, index: number, len: number, max = 260): string {
  let start = index;
  let end = index + len;
  while (start > 0 && !/[.\n;!?]/.test(text[start - 1]) && index - start < max / 2) start--;
  while (end < text.length && !/[.\n;!?]/.test(text[end]) && end - index < max / 2) end++;
  if (end < text.length && /[.;!?]/.test(text[end])) end++;
  return text.slice(start, end).trim();
}

export function heuristicScan(text: string, now: Date, source: ScanResult["source"] = "heuristic"): ScanResult {
  const t = text.slice(0, MAX_CONTRACT_CHARS);
  const low = t.toLowerCase();
  const items = CONTRACT_ITEMS.map((item) => {
    for (const kw of item.keywords) {
      const i = low.indexOf(kw.toLowerCase());
      if (i >= 0) return { id: item.id, found: true, quote: snippetAround(t, i, kw.length), note: null };
    }
    return { id: item.id, found: false, quote: null, note: null };
  });
  return { source, at: now.toISOString(), chars: t.length, items };
}

export const scanAiSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        found: z.boolean(),
        quote: z.string().max(400).nullable(),
        note: z.string().max(240).nullable(),
      }),
    )
    .max(40),
});

export function scanPrompt(text: string, lang: Lang) {
  const language = lang === "he" ? "Hebrew" : "English";
  const items = CONTRACT_ITEMS.map((i) => ({ id: i.id, topic: i.title.en, lookFor: i.look.en }));
  return [
    {
      role: "system" as const,
      content:
        "You review an Israeli employment contract that the user pasted, against a fixed list of topics. " +
        "For EACH topic id return {id, found, quote, note}. `quote` must be copied EXACTLY, character for character, " +
        "from the contract text (max 300 chars), or null if the topic is not covered. Never paraphrase inside quote. " +
        `\`note\` is at most one short sentence in ${language} on what to clarify, or null. ` +
        "Do not state laws, legal minimums, numbers or facts that are not in the quoted text. This is not legal advice. " +
        'Return JSON {"items": [...]}.',
    },
    { role: "user" as const, content: JSON.stringify({ topics: items, contract: text.slice(0, MAX_CONTRACT_CHARS) }) },
  ];
}

/** Keep only well-formed AI items: known ids, verbatim quotes, notes without numbers missing from the quote. */
export function validateAiScan(raw: unknown, text: string, now: Date): ScanResult | null {
  const r = scanAiSchema.safeParse(raw);
  if (!r.success) return null;
  const hay = norm(text.slice(0, MAX_CONTRACT_CHARS));
  const byId = new Map<string, ScanItem>();
  for (const it of r.data.items) {
    if (!ITEM_IDS.includes(it.id) || byId.has(it.id)) continue;
    const q = it.quote ? norm(it.quote) : "";
    const quote = q.length >= 4 && hay.includes(q) ? q : null;
    let note = it.note ? norm(it.note) : null;
    if (note) {
      const nums = note.match(/\d+(?:[.,]\d+)?/g) ?? [];
      if (nums.some((n) => !(quote ?? "").includes(n))) note = null;
    }
    byId.set(it.id, { id: it.id, found: !!quote, quote, note });
  }
  if (byId.size === 0) return null;
  const items = ITEM_IDS.map((id) => byId.get(id) ?? { id, found: false, quote: null, note: null });
  return { source: "ai", at: now.toISOString(), chars: Math.min(text.length, MAX_CONTRACT_CHARS), items };
}
