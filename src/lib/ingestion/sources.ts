import type { AtsProvider } from "@prisma/client";

/**
 * Curated list of hi-tech companies with an Israeli office whose job boards are published through a
 * public, documented ATS job-board API. Each board was verified to return Israel-located openings
 * (see docs/sources.md for how to verify / add one).
 *
 * boardId formats:
 *  - GREENHOUSE: board token, e.g. "similarweb" → boards-api.greenhouse.io/v1/boards/similarweb/jobs
 *  - LEVER: site name, prefixed with "eu:" for Lever's EU instance, e.g. "eu:mobileye" → api.eu.lever.co
 *  - COMEET: "<companyUid>:<careersApiToken>" — only with a token the company itself provides.
 *
 * Only Israel-located (or Israel-remote) postings are ingested; see `isIsraelLocation`.
 */
export interface JobSource {
  slug: string;
  name: string;
  provider: Exclude<AtsProvider, "MANUAL">;
  boardId: string;
  website: string;
  industry: string;
  hqLocation: string;
}

const gh = (slug: string, name: string, boardId: string, website: string, industry: string, hq = "Tel Aviv") =>
  ({ slug, name, provider: "GREENHOUSE", boardId, website, industry, hqLocation: hq }) as const satisfies JobSource;
const lever = (slug: string, name: string, boardId: string, website: string, industry: string, hq = "Tel Aviv") =>
  ({ slug, name, provider: "LEVER", boardId, website, industry, hqLocation: hq }) as const satisfies JobSource;

export const JOB_SOURCES: JobSource[] = [
  // Greenhouse
  gh("similarweb", "Similarweb", "similarweb", "https://www.similarweb.com", "Digital intelligence"),
  gh("payoneer", "Payoneer", "payoneer", "https://www.payoneer.com", "Fintech", "Herzliya"),
  gh("riskified", "Riskified", "riskified", "https://www.riskified.com", "E-commerce fraud prevention"),
  gh("taboola", "Taboola", "taboola", "https://www.taboola.com", "AdTech"),
  gh("appsflyer", "AppsFlyer", "appsflyer", "https://www.appsflyer.com", "Marketing analytics", "Herzliya"),
  gh("jfrog", "JFrog", "jfrog", "https://jfrog.com", "DevOps / software supply chain", "Netanya"),
  gh("axonius", "Axonius", "axonius", "https://www.axonius.com", "Cybersecurity"),
  gh("wiz", "Wiz", "wizinc", "https://www.wiz.io", "Cloud security"),
  gh("orca-security", "Orca Security", "orcasecurity", "https://orca.security", "Cloud security"),
  gh("transmit-security", "Transmit Security", "transmitsecurity", "https://transmitsecurity.com", "Identity security"),
  gh("yotpo", "Yotpo", "yotpo", "https://www.yotpo.com", "E-commerce marketing"),
  gh("gong", "Gong", "gongio", "https://www.gong.io", "Revenue intelligence / AI"),
  gh("melio", "Melio", "melio", "https://meliopayments.com", "Fintech"),
  gh("forter", "Forter", "forter", "https://www.forter.com", "E-commerce fraud prevention"),
  gh("via", "Via", "via", "https://ridewithvia.com", "Mobility / transit tech"),
  gh("sentinelone", "SentinelOne", "sentinellabs", "https://www.sentinelone.com", "Cybersecurity"),
  gh("bigid", "BigID", "bigid", "https://bigid.com", "Data security & privacy"),
  gh("island", "Island", "island", "https://www.island.io", "Enterprise browser / security"),
  gh("torq", "Torq", "torq", "https://torq.io", "Security automation"),
  gh("optimove", "Optimove", "optimove", "https://www.optimove.com", "Marketing tech"),
  gh("cato-networks", "Cato Networks", "catonetworks", "https://www.catonetworks.com", "Network security (SASE)"),
  gh("tipalti", "Tipalti", "tipaltisolutions", "https://tipalti.com", "Fintech"),
  gh("playtika", "Playtika", "playtikaltd", "https://www.playtika.com", "Gaming", "Herzliya"),
  gh("obligo", "Obligo", "obligo", "https://www.myobligo.com", "PropTech / fintech"),
  gh("cymulate", "Cymulate", "cymulate", "https://cymulate.com", "Cybersecurity", "Israel"),
  gh("safebreach", "SafeBreach", "safebreach", "https://www.safebreach.com", "Cybersecurity"),
  gh("apiiro", "Apiiro", "apiiro", "https://apiiro.com", "Application security"),
  gh("salt-security", "Salt Security", "saltsecurity", "https://salt.security", "API security"),
  gh("lightrun", "Lightrun", "lightrun", "https://lightrun.com", "Developer tools / observability"),
  gh("datarails", "Datarails", "datarails", "https://www.datarails.com", "Fintech / FP&A"),
  gh("eon", "Eon", "eonio", "https://www.eon.io", "Cloud backup"),
  gh("unframe", "Unframe", "unframe", "https://www.unframe.ai", "Enterprise AI"),
  gh("nanit", "Nanit", "nanit", "https://www.nanit.com", "Consumer IoT / computer vision", "Ramat Gan"),
  gh("bluevine", "Bluevine", "bluevineisrael", "https://www.bluevine.com", "Fintech"),
  gh("guardz", "Guardz", "guardz", "https://guardz.com", "Cybersecurity"),
  gh("eleos-health", "Eleos Health", "eleoshealth", "https://eleos.health", "HealthTech / AI"),
  gh("astera-labs", "Astera Labs", "asteralabs", "https://www.asteralabs.com", "Semiconductors"),
  gh("pendo", "Pendo", "pendo", "https://www.pendo.io", "Product analytics", "Herzliya"),
  // Lever
  lever("cloudinary", "Cloudinary", "cloudinary", "https://cloudinary.com", "Media developer platform", "Petah Tikva"),
  lever("walkme", "WalkMe", "walkme", "https://www.walkme.com", "Digital adoption"),
  lever("cye", "CYE", "CYE", "https://cyesec.com", "Cybersecurity", "Herzliya"),
  lever("zadara", "Zadara", "Zadara", "https://www.zadara.com", "Cloud infrastructure"),
  lever("lendbuzz", "Lendbuzz", "lendbuzz", "https://www.lendbuzz.com", "Fintech / AI lending"),
  lever("traild", "Traild", "traildsoftware", "https://www.traild.com", "Retail software"),
  lever("mobileye", "Mobileye", "eu:mobileye", "https://www.mobileye.com", "Autonomous driving", "Jerusalem"),
];
