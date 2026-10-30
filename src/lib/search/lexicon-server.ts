import { db } from "@/lib/db";
import { buildCompanyLexicon, type CompanyLexicon } from "./lexicon";

/** Company lexicon cache: names change rarely, so one build serves every search for a few minutes. */
const TTL_MS = 5 * 60 * 1000;
let cached: { at: number; lexicon: Promise<CompanyLexicon> } | null = null;

/** All companies' names and aliases for bilingual search (cached per server instance). */
export function loadCompanyLexicon(): Promise<CompanyLexicon> {
  // Tests swap the mocked company list between cases, so they always rebuild.
  if (process.env.NODE_ENV === "test")
    return db.company
      .findMany({ select: { id: true, name: true, nameHe: true, aliases: true } })
      .then(buildCompanyLexicon);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.lexicon;
  const lexicon = db.company
    .findMany({ select: { id: true, name: true, nameHe: true, aliases: true } })
    .then(buildCompanyLexicon)
    .catch((err) => {
      cached = null;
      throw err;
    });
  cached = { at: Date.now(), lexicon };
  return lexicon;
}
