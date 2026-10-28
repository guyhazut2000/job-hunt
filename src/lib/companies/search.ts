import { domainOf } from "../jobs/search";
import { normalizeSearchText, type SearchTerm } from "../search/query";

export interface SearchableCompany {
  name: string;
  slug?: string | null;
  website?: string | null;
  careersUrl?: string | null;
  industry?: string | null;
  hqLocation?: string | null;
  atsProvider?: string | null;
  addedVia?: string | null;
}

/** Everything a company can be found by: name, slug, website/careers domains, field, HQ and ATS. */
export function companySearchText(c: SearchableCompany): string {
  return normalizeSearchText(
    [
      c.name,
      c.slug?.replace(/-/g, " "),
      domainOf(c.website),
      domainOf(c.careersUrl),
      c.industry,
      c.hqLocation,
      c.atsProvider && c.atsProvider !== "MANUAL" ? c.atsProvider : null,
    ]
      .filter(Boolean)
      .join(" | "),
  );
}

/** Every term must match (any of its variants). An empty term list matches everything. */
export function companyMatchesTerms(c: SearchableCompany, terms: SearchTerm[]): boolean {
  if (!terms.length) return true;
  const hay = companySearchText(c);
  return terms.every((t) => t.variants.some((v) => hay.includes(v)));
}
