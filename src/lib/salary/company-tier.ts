/**
 * Company pay tier — an explicitly labelled ESTIMATE.
 *
 * Rationale: Israeli surveys and the CBS sector split consistently show that large public companies,
 * multinational R&D centres and late-stage unicorns pay above the market median, and early-stage
 * startups pay at or below it (with more equity). We do not have per-company pay data, so we apply a
 * small, conservative multiplier and always show it to the user as an adjustment, never silently.
 *
 * Tier "established" = publicly traded or a widely reported $1B+ valuation / acquisition, as of 2026.
 * Curated by hand from public information; extend as companies are added to src/lib/ingest/sources.ts.
 */

export type CompanyTier = "established" | "growth" | "early";

export const TIER_FACTOR: Record<CompanyTier, number> = {
  established: 1.08,
  growth: 1,
  early: 0.95,
};

const ESTABLISHED = new Set([
  "mobileye",
  "cato-networks",
  "similarweb",
  "astera-labs",
  "payoneer",
  "taboola",
  "wiz",
  "appsflyer",
  "sentinelone",
  "jfrog",
  "riskified",
  "gong",
  "transmit-security",
  "island",
  "playtika",
  "melio",
  "via",
  "tipalti",
  "cloudinary",
  "axonius",
  "walkme",
  "yotpo",
  "pendo",
  "forter",
  "bigid",
  "cyera",
  "snyk",
  "monday",
  "fiverr",
  "wix",
  "lemonade",
  "nice",
  "check-point",
  "cyberark",
]);

export function companyTier(company: { slug: string; size?: string | null }): {
  tier: CompanyTier;
  basis: "curated" | "size" | "default";
} {
  if (ESTABLISHED.has(company.slug)) return { tier: "established", basis: "curated" };
  const size = company.size ?? "";
  if (/^(1000\+|5000\+|10000\+)/.test(size)) return { tier: "established", basis: "size" };
  if (/^(1-10|10-50|11-50)$/.test(size)) return { tier: "early", basis: "size" };
  return { tier: "growth", basis: "default" };
}
