import { gunzipSync } from "node:zlib";
import { USER_AGENT } from "../ingestion/http";
import { domainOf } from "./domain";
import { readTar } from "./tar";

/**
 * Public, free startup directories used for discovery (see docs/startup-discovery.md for the full
 * comparison, licences and costs). Every source here is an official open-data download or API — no
 * scraping of sites whose terms forbid it, and never LinkedIn.
 */
export type DiscoverySource = "TECHMAP" | "YC" | "WIKIDATA" | "CRUNCHBASE";

export interface DiscoveredStartup {
  name: string;
  website: string;
  domain: string;
  source: DiscoverySource;
  sourceUrl?: string;
  description?: string;
  location?: string;
  industry?: string;
  size?: string;
  foundedYear?: number;
  careersUrl?: string;
  priority: number;
  hints?: AtsHints;
}

/** ATS identifiers a source already knows. */
export interface AtsHints {
  greenhouse?: string;
  lever?: string;
  /** Comeet "<slug>/<companyUid>" (no token: the token is read from the company's own careers page). */
  comeet?: string;
}

const SIZE_PRIORITY: Record<string, number> = { xl: 50, l: 40, m: 30, s: 10, xs: 0 };

async function get(url: string, accept: string, timeoutMs = 60_000): Promise<Response> {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${new URL(url).host}: HTTP ${res.status}`);
  return res;
}

// ---------------------------------------------------------------------------------------------
// Israeli Tech Map (github.com/mluggy/techmap) — ODbL 1.0 open database of ~8k Israeli tech
// companies (website, careers URL, size, category, ATS ids), kept up to date against רשם החברות.
// Downloaded as GitHub's official source tarball (one request).
// ---------------------------------------------------------------------------------------------

export const TECHMAP_REPO = "https://github.com/mluggy/techmap";
const TECHMAP_TARBALL = "https://codeload.github.com/mluggy/techmap/tar.gz/refs/heads/main";

interface TechMapCompany {
  name?: string;
  description?: string | null;
  categoryId?: number | null;
  size?: string | null;
  websiteUrl?: string | null;
  careersUrl?: string | null;
  comeetId?: string | null;
  greenhouseId?: string | null;
  leverId?: string | null;
  addresses?: { city?: string | null }[] | null;
  isActive?: boolean;
}

export const TECHMAP_CATEGORIES: Record<string, string> = {
  "1": "AI/ML",
  "2": "AdTech",
  "3": "Aerospace",
  "4": "AR/VR",
  "5": "Automotive",
  "6": "Cloud Computing",
  "7": "Cybersecurity",
  "8": "Digital Media",
  "9": "E-commerce & Retail",
  "10": "Fintech",
  "11": "Gaming",
  "12": "Health",
  "13": "IoT",
  "14": "Productivity",
  "15": "Robotics & Automation",
  "16": "Semiconductors",
  "17": "Sustainable Technology",
  "18": "Telecommunications",
};

export function parseTechMapCompany(id: string, c: TechMapCompany, hiring: Set<string>): DiscoveredStartup | null {
  if (c.isActive === false || !c.name || !c.websiteUrl) return null;
  const domain = domainOf(c.websiteUrl);
  if (!domain) return null;
  const careers = c.careersUrl && domainOf(c.careersUrl) ? c.careersUrl : undefined;
  const hints: AtsHints = {};
  if (c.greenhouseId) hints.greenhouse = c.greenhouseId;
  if (c.leverId) hints.lever = c.leverId;
  if (c.comeetId && /^[^/\s]+\/[A-F0-9]{2}\.[A-F0-9]{3}$/i.test(c.comeetId)) hints.comeet = c.comeetId;
  const hasHints = Object.keys(hints).length > 0;
  const size = c.size ?? undefined;
  // Tiny companies without any careers signal rarely publish an Israeli job feed: skip them.
  if ((size === "xs" || !size) && !careers && !hasHints && !hiring.has(c.name)) return null;
  return {
    name: c.name.trim(),
    website: c.websiteUrl,
    domain,
    source: "TECHMAP",
    sourceUrl: `${TECHMAP_REPO}/blob/main/companies/${id}.json`,
    description: c.description?.slice(0, 500) ?? undefined,
    location: c.addresses?.find((a) => a.city)?.city ?? undefined,
    industry: c.categoryId ? TECHMAP_CATEGORIES[String(c.categoryId)] : undefined,
    size,
    careersUrl: careers,
    priority:
      (SIZE_PRIORITY[size ?? ""] ?? 0) + (hasHints ? 20 : 0) + (careers ? 15 : 0) + (hiring.has(c.name) ? 10 : 0),
    hints: hasHints ? hints : undefined,
  };
}

export async function fetchTechMap(): Promise<DiscoveredStartup[]> {
  const res = await get(TECHMAP_TARBALL, "application/gzip", 90_000);
  const tar = gunzipSync(Buffer.from(await res.arrayBuffer()));
  const companies: [string, TechMapCompany][] = [];
  const hiring = new Set<string>();
  for (const e of readTar(tar, (p) => /\/companies\/[^/]+\.json$/.test(p) || /\/jobs\/[^/]+\.csv$/.test(p))) {
    if (e.path.endsWith(".json")) {
      try {
        companies.push([e.path.replace(/^.*\/|\.json$/g, ""), JSON.parse(e.data.toString("utf8"))]);
      } catch {
        /* skip malformed file */
      }
    } else {
      // jobs/*.csv: "company",... — only the company names are used (as a "hiring now" signal).
      for (const line of e.data.toString("utf8").split("\n").slice(1)) {
        const m = /^"((?:[^"]|"")*)"/.exec(line);
        if (m) hiring.add(m[1].replace(/""/g, '"'));
      }
    }
  }
  return companies.map(([id, c]) => parseTechMapCompany(id, c, hiring)).filter((x): x is DiscoveredStartup => !!x);
}

// ---------------------------------------------------------------------------------------------
// Y Combinator company directory via yc-oss/api (MIT, daily mirror of YC's public directory JSON).
// ---------------------------------------------------------------------------------------------

const YC_ALL = "https://yc-oss.github.io/api/companies/all.json";

interface YcCompany {
  name?: string;
  slug?: string;
  website?: string;
  all_locations?: string;
  regions?: string[];
  status?: string;
  isHiring?: boolean;
  one_liner?: string;
  industry?: string;
  team_size?: number | null;
  batch?: string;
  url?: string;
}

export function parseYcCompany(c: YcCompany): DiscoveredStartup | null {
  const israeli = (c.regions ?? []).includes("Israel") || /\bIsrael\b/.test(c.all_locations ?? "");
  if (!israeli || !c.name || !c.website) return null;
  if (c.status && !["Active", "Public"].includes(c.status)) return null;
  const domain = domainOf(c.website);
  if (!domain) return null;
  const year = /(\d{4})/.exec(c.batch ?? "")?.[1];
  return {
    name: c.name.trim(),
    website: c.website,
    domain,
    source: "YC",
    sourceUrl: c.url ?? (c.slug ? `https://www.ycombinator.com/companies/${c.slug}` : undefined),
    description: c.one_liner,
    location: c.all_locations,
    industry: c.industry,
    size: teamSizeBucket(c.team_size),
    foundedYear: year ? Number(year) : undefined,
    priority: 25 + (c.isHiring ? 15 : 0),
  };
}

function teamSizeBucket(n: number | null | undefined): string | undefined {
  if (!n) return undefined;
  return n <= 10 ? "xs" : n <= 50 ? "s" : n <= 200 ? "m" : n <= 1000 ? "l" : "xl";
}

export async function fetchYc(): Promise<DiscoveredStartup[]> {
  const rows = (await (await get(YC_ALL, "application/json")).json()) as YcCompany[];
  return rows.map(parseYcCompany).filter((x): x is DiscoveredStartup => !!x);
}

// ---------------------------------------------------------------------------------------------
// Wikidata (CC0) via the official SPARQL endpoint: Israeli companies founded since 2010 that have an
// official website and aren't dissolved. Noisier than the others (it includes non-tech firms), so it
// gets the lowest priority and non-tech industries are dropped.
// ---------------------------------------------------------------------------------------------

const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";
export const WIKIDATA_QUERY = `SELECT ?c ?cLabel ?site (MIN(?inc) AS ?founded) (SAMPLE(?indLabel) AS ?industry) WHERE {
  VALUES ?type { wd:Q4830453 wd:Q6881511 wd:Q1058914 wd:Q20076236 wd:Q18388277 wd:Q891723 }
  ?c wdt:P31 ?type; wdt:P17 wd:Q801; wdt:P856 ?site; wdt:P571 ?inc.
  FILTER(YEAR(?inc) >= 2010)
  FILTER NOT EXISTS { ?c wdt:P576 ?dissolved }
  OPTIONAL { ?c wdt:P452 ?ind. ?ind rdfs:label ?indLabel. FILTER(LANG(?indLabel) = "en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,he". }
} GROUP BY ?c ?cLabel ?site LIMIT 2000`;

const NON_TECH =
  /petroleum|oil|gas|real estate|reit|food|beverage|holding|venture capital|bank|insurance company|printing|retail chain|construction|mining|airline|textile|agricultur|tobacco|casino|football|sport/i;

interface SparqlRow {
  c?: { value: string };
  cLabel?: { value: string };
  site?: { value: string };
  founded?: { value: string };
  industry?: { value: string };
}

export function parseWikidataRow(r: SparqlRow): DiscoveredStartup | null {
  const name = r.cLabel?.value;
  const site = r.site?.value;
  if (!name || !site || /^Q\d+$/.test(name)) return null;
  if (r.industry?.value && NON_TECH.test(r.industry.value)) return null;
  const domain = domainOf(site);
  if (!domain) return null;
  const year = r.founded?.value ? new Date(r.founded.value).getUTCFullYear() : undefined;
  return {
    name,
    website: site,
    domain,
    source: "WIKIDATA",
    sourceUrl: r.c?.value,
    industry: r.industry?.value,
    foundedYear: Number.isFinite(year) ? year : undefined,
    location: "Israel",
    priority: 5,
  };
}

export async function fetchWikidata(): Promise<DiscoveredStartup[]> {
  const url = `${WIKIDATA_SPARQL}?query=${encodeURIComponent(WIKIDATA_QUERY)}`;
  const json = (await (await get(url, "application/sparql-results+json", 70_000)).json()) as {
    results: { bindings: SparqlRow[] };
  };
  return json.results.bindings.map(parseWikidataRow).filter((x): x is DiscoveredStartup => !!x);
}

// ---------------------------------------------------------------------------------------------
// Crunchbase API v4 (paid / licensed). Only used when CRUNCHBASE_API_KEY is set.
// ---------------------------------------------------------------------------------------------

export function crunchbaseEnabled(): boolean {
  return !!process.env.CRUNCHBASE_API_KEY;
}

export async function fetchCrunchbase(): Promise<DiscoveredStartup[]> {
  const key = process.env.CRUNCHBASE_API_KEY;
  if (!key) return [];
  const res = await fetch("https://api.crunchbase.com/api/v4/searches/organizations", {
    method: "POST",
    headers: { "user-agent": USER_AGENT, "content-type": "application/json", "X-cb-user-key": key },
    body: JSON.stringify({
      field_ids: ["identifier", "website_url", "short_description", "location_identifiers", "founded_on"],
      query: [
        { type: "predicate", field_id: "location_identifiers", operator_id: "includes", values: ["israel"] },
        { type: "predicate", field_id: "facet_ids", operator_id: "includes", values: ["company"] },
      ],
      limit: 1000,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Crunchbase: HTTP ${res.status}`);
  const json = (await res.json()) as {
    entities?: {
      properties: {
        identifier?: { value?: string; permalink?: string };
        website_url?: string;
        short_description?: string;
        founded_on?: { value?: string };
      };
    }[];
  };
  return (json.entities ?? []).flatMap(({ properties: p }) => {
    const domain = domainOf(p.website_url);
    if (!domain || !p.identifier?.value || !p.website_url) return [];
    return [
      {
        name: p.identifier.value,
        website: p.website_url,
        domain,
        source: "CRUNCHBASE" as const,
        sourceUrl: p.identifier.permalink
          ? `https://www.crunchbase.com/organization/${p.identifier.permalink}`
          : undefined,
        description: p.short_description,
        foundedYear: p.founded_on?.value ? Number(p.founded_on.value.slice(0, 4)) : undefined,
        location: "Israel",
        priority: 20,
      },
    ];
  });
}
