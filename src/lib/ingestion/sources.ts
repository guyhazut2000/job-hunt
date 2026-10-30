import type { AtsProvider } from "@prisma/client";
import { ESTABLISHED_SOURCES, withoutHub } from "../companies/established";

/**
 * Curated list of hi-tech companies with an Israeli office whose job boards are published through a
 * public, documented ATS job-board API. Each board was verified to return Israel-located openings
 * (see docs/sources.md for how to verify / add one).
 *
 * boardId formats:
 *  - GREENHOUSE: board token, e.g. "similarweb" → boards-api.greenhouse.io/v1/boards/similarweb/jobs
 *  - LEVER: site name, prefixed with "eu:" for Lever's EU instance, e.g. "eu:mobileye" → api.eu.lever.co
 *  - COMEET: "<companyUid>:<careersApiToken>" — only the public, read-only careers-site token the company
 *    itself embeds in its own careers page (or the Comeet-hosted page it links to). See docs/sources.md.
 *  - ASHBY: job-board name → api.ashbyhq.com/posting-api/job-board/<name>
 *  - WORKABLE: account subdomain → apply.workable.com/api/v1/widget/accounts/<name>
 *  - SMARTRECRUITERS: company identifier → api.smartrecruiters.com/v1/companies/<id>/postings
 *  - RECRUITEE: company subdomain → <name>.recruitee.com/api/offers/
 *  - WORDPRESS: "<host>" or "<host>/<postType>" → <host>/wp-json/wp/v2/<postType> (default post type "job")
 *  - WORKDAY: "<tenant>/<wdN>/<site>" → <tenant>.<wdN>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs
 *    (only the "Israel" location facet is requested, paginated and paced)
 *  - EIGHTFOLD: "<host>/<domain>" → <host>/api/pcsx/search?domain=<domain>&location=Israel
 *  - ORACLE_HCM: "<host>/<siteNumber>" → <host>/hcmRestApi/resources/latest/recruitingCEJobRequisitions
 *    (Oracle Recruiting Cloud candidate experience; filtered by the site's "Israel" location facet)
 *  - JIBE: "<host>" → <host>/api/jobs?location=Israel (iCIMS Jibe careers sites)
 *  - AMAZON: ISO-3 country code ("ISR") → www.amazon.jobs/en/search.json
 *  - SUCCESSFACTORS: "<host>" → <host>/search/?locationsearch=Israel + job pages (SAP Career Site Builder;
 *    public HTML on robots-allowed paths only, details fetched once per new posting)
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
  /** The company's own careers page, shown next to the jobs (set once on create). */
  careersUrl?: string;
}

const gh = (slug: string, name: string, boardId: string, website: string, industry: string, hq = "Tel Aviv") =>
  ({ slug, name, provider: "GREENHOUSE", boardId, website, industry, hqLocation: hq }) as const satisfies JobSource;
const src =
  (provider: JobSource["provider"], defaultHq = "Tel Aviv") =>
  (slug: string, name: string, boardId: string, website: string, industry: string, hq = defaultHq): JobSource => ({
    slug,
    name,
    provider,
    boardId,
    website,
    industry,
    hqLocation: hq,
  });
const comeet = src("COMEET");
const ashby = src("ASHBY");
const workable = src("WORKABLE");
const sr = src("SMARTRECRUITERS");
const recruitee = src("RECRUITEE");
const workday = src("WORKDAY");
const eightfold = src("EIGHTFOLD");
const oracle = src("ORACLE_HCM");
const jibe = src("JIBE");
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

  // ---- Added with the Ashby / Workable / SmartRecruiters / Recruitee / Workday / Comeet adapters ----
  // Greenhouse (boards linked from each company's own careers page)
  gh("hello-heart", "Hello Heart", "helloheart", "https://www.helloheart.com", "Digital health"),
  gh("nice", "NICE", "nice", "https://www.nice.com", "CX / contact-center software", "Ra'anana"),
  gh("descope", "Descope", "descope", "https://www.descope.com", "Identity / CIAM"),
  gh("token-security", "Token Security", "tokensecurity", "https://www.token.security", "Identity security"),
  gh("duda", "Duda", "duda", "https://www.duda.co", "Website builder platform"),
  gh("connecteam", "Connecteam", "connecteam", "https://connecteam.com", "Workforce management"),
  gh("wolt", "Wolt", "wolt", "https://wolt.com", "Delivery platform", "Helsinki"),
  gh("electreon", "Electreon", "electreon", "https://electreon.com", "EV wireless charging", "Beit Yanai"),
  gh("aidoc", "Aidoc", "aidocmedical", "https://www.aidoc.com", "Medical imaging AI"),
  gh("k-health", "K Health", "khealthcareers", "https://khealth.com", "HealthTech / AI", "New York"),
  gh("pagaya", "Pagaya", "pagayais", "https://pagaya.com", "Fintech / AI lending"),
  gh("next-insurance", "Next Insurance", "nextinsurance66", "https://www.nextinsurance.com", "Insurtech", "Palo Alto"),
  gh("navan", "Navan", "tripactions", "https://navan.com", "Travel & expense", "Palo Alto"),
  gh("datadog", "Datadog", "datadog", "https://www.datadoghq.com", "Observability", "New York"),
  gh("okta", "Okta", "okta", "https://www.okta.com", "Identity", "San Francisco"),
  gh("mongodb", "MongoDB", "mongodb", "https://www.mongodb.com", "Database", "New York"),
  gh("zscaler", "Zscaler", "zscaler", "https://www.zscaler.com", "Cloud security", "San Jose"),
  gh("rubrik", "Rubrik", "rubrik", "https://www.rubrik.com", "Data security", "Palo Alto"),
  gh("gitlab", "GitLab", "gitlab", "https://about.gitlab.com", "DevOps platform", "Remote"),
  gh("elastic", "Elastic", "elastic", "https://www.elastic.co", "Search / observability", "San Francisco"),
  gh("figma", "Figma", "figma", "https://www.figma.com", "Design software", "San Francisco"),
  // Lever
  lever("biocatch", "BioCatch", "biocatch", "https://www.biocatch.com", "Behavioral biometrics / fraud"),
  // Comeet (public careers-site tokens, see docs/sources.md)
  comeet(
    "aqua-security",
    "Aqua Security",
    "91.001:191644966966644E194B3191644644",
    "https://www.aquasec.com",
    "Cloud-native security",
    "Ramat Gan",
  ),
  comeet(
    "pentera",
    "Pentera",
    "C5.00D:5CD1D013435289B343501D012E682E68289B",
    "https://pentera.io",
    "Automated security validation",
    "Petah Tikva",
  ),
  comeet(
    "silverfort",
    "Silverfort",
    "54.007:45715B315B38AE22B8D051A0A457D051E61",
    "https://www.silverfort.com",
    "Identity security",
    "Tel Aviv",
  ),
  comeet(
    "arbe",
    "Arbe",
    "C6.001:6C12886D821B0414432886144328862F472F47",
    "https://arberobotics.com",
    "Automotive imaging radar",
    "Tel Aviv",
  ),
  comeet(
    "nextsilicon",
    "NextSilicon",
    "18.007:817308A2873102E1845308A308A40B8308A205C",
    "https://www.nextsilicon.com",
    "Semiconductors / HPC",
    "Givatayim",
  ),
  comeet(
    "riverside",
    "Riverside",
    "66.009:66926766692CDF00669CD22CDF133B",
    "https://careers.riverside.com",
    "Video & podcast creation",
    "Tel Aviv",
  ),
  comeet(
    "wiliot",
    "Wiliot",
    "F6.003:6F329B2DE6379829B229B2037983E8B3E8B",
    "https://www.wiliot.com",
    "IoT / ambient computing",
    "Caesarea",
  ),
  comeet(
    "zenity",
    "Zenity",
    "19.000:9103660519012202D5024401B3091024403660",
    "https://zenity.io",
    "AI agent security",
    "Tel Aviv",
  ),
  comeet(
    "scytale",
    "Scytale",
    "2A.009:A29471F1E7B5B7128A432CDA2928A45B711452",
    "https://scytale.ai",
    "Compliance automation",
    "Tel Aviv",
  ),
  comeet(
    "ai21-labs",
    "AI21 Labs",
    "E6.001:6E12946DC230276E13DE93708294637083708",
    "https://www.ai21.com",
    "Generative AI",
    "Tel Aviv",
  ),
  comeet(
    "mitiga",
    "Mitiga",
    "26.00B:62B250262B012811ED718AC128112813158",
    "https://www.mitiga.io",
    "Cloud incident response",
    "Tel Aviv",
  ),
  comeet(
    "ox-security",
    "OX Security",
    "F8.006:8F635C447B035C42CCE2CCE23D83EBA35C48F6",
    "https://www.ox.security",
    "Application security",
    "Tel Aviv",
  ),
  comeet(
    "tailor-brands",
    "Tailor Brands",
    "94.009:49916FD16FD24C89320DCB296116FD2961",
    "https://www.tailorbrands.com",
    "SMB online business platform",
    "Tel Aviv",
  ),
  comeet(
    "minute-media",
    "Minute Media",
    "45.00A:54A1A7225062A50FDE2F9A1FBC01FBC1528",
    "https://www.minutegroup.com",
    "Digital media / sports content",
    "Tel Aviv",
  ),
  comeet(
    "elementor",
    "Elementor",
    "A3.00F:3AF126BB0D161A3AF161A00B0D126B",
    "https://elementor.careers",
    "Website builder",
    "Ramat Gan",
  ),
  comeet(
    "etoro",
    "eToro",
    "41.009:14952452466D3DB7B61495240B91",
    "https://www.etoro.com",
    "Fintech / trading",
    "Bnei Brak",
  ),
  comeet(
    "cycode",
    "Cycode",
    "A8.00D:8AD340E3CBB3CBB22B445680340E22B44568",
    "https://cycode.com",
    "Application security",
    "Tel Aviv",
  ),
  comeet(
    "akeyless",
    "Akeyless",
    "27.006:7262AE41572157215721C984056E4C405623BE",
    "https://www.akeyless.io",
    "Secrets management",
    "Ramat Gan",
  ),
  comeet(
    "morphisec",
    "Morphisec",
    "65.00C:56C1B1C2B600208825F42B601B1C0AD8",
    "https://www.morphisec.com",
    "Endpoint security",
    "Be'er Sheva",
  ),
  comeet(
    "ironscales",
    "Ironscales",
    "1A.007:A1746A11E453C8A285C142E3273327332730",
    "https://ironscales.com",
    "Email security",
    "Tel Aviv",
  ),
  comeet(
    "personetics",
    "Personetics",
    "83.00A:38A11B2A9E018C60153C714A9E38A",
    "https://personetics.com",
    "Banking AI",
    "Tel Aviv",
  ),
  comeet(
    "easysend",
    "EasySend",
    "D5.009:5D91D3D34A134A134A12EC85D9118B1764118B",
    "https://www.easysend.io",
    "Digital customer journeys",
    "Tel Aviv",
  ),
  comeet(
    "anyword",
    "Anyword",
    "30.00B:3BB12131D8EC1271D801271D8",
    "https://www.anyword.com",
    "AI marketing copy",
    "Tel Aviv",
  ),
  comeet(
    "gloat",
    "Gloat",
    "E5.000:5E02340002F0017800234011A01780",
    "https://gloat.com",
    "Workforce agility / HR tech",
    "Tel Aviv",
  ),
  comeet(
    "superplay",
    "SuperPlay",
    "28.003:82330D228AF208C208C493B30D2208C38F538F5",
    "https://www.superplay.co",
    "Mobile gaming",
    "Petah Tikva",
  ),
  comeet(
    "moovit",
    "Moovit",
    "63.007:36711036CE11031E9F146A1B38367A356CE",
    "https://moovit.com",
    "Mobility / transit app",
    "Ness Ziona",
  ),
  comeet(
    "ceragon",
    "Ceragon",
    "D3.003:3D3131FF4C01AC57A61AC51E98131FF4C",
    "https://www.ceragon.com",
    "Wireless backhaul",
    "Rosh HaAyin",
  ),
  comeet(
    "cyera",
    "Cyera",
    "17.008:7182A90154871823783FD838C031A802378",
    "https://www.cyera.com",
    "Data security",
    "Tel Aviv",
  ),
  comeet(
    "sygnia",
    "Sygnia",
    "78.00A:87A32DC3B5687A196E2A6210F43B5610F43B56",
    "https://www.sygnia.co",
    "Cyber incident response",
    "Tel Aviv",
  ),
  comeet(
    "upwind",
    "Upwind",
    "49.004:94440DC0944094401BCC12882510",
    "https://www.upwind.io",
    "Cloud security",
    "Tel Aviv",
  ),
  comeet(
    "port",
    "Port",
    "59.004:954414C02550414C4AA01BFC12A81BFC2550",
    "https://www.port.io",
    "Internal developer portal",
    "Tel Aviv",
  ),
  comeet(
    "zesty",
    "Zesty",
    "06.000:600240001E00030003000300024001E00",
    "https://zesty.co",
    "Cloud cost optimization",
    "Tel Aviv",
  ),
  comeet(
    "seemplicity",
    "Seemplicity",
    "67.00D:76D2C8E164733FB33FB1DB442D5042D5EDA",
    "https://seemplicity.ai",
    "Security remediation",
    "Tel Aviv",
  ),
  comeet(
    "reco",
    "Reco",
    "3A.00D:A3D47AB28F405C2505C2551E8333151E8",
    "https://www.reco.ai",
    "SaaS security",
    "Tel Aviv",
  ),
  comeet(
    "cognyte",
    "Cognyte",
    "F2.009:2F9EDD2F92F911D61AC12F914CF11D62F9",
    "https://www.cognyte.com",
    "Investigative analytics",
    "Herzliya",
  ),
  comeet(
    "radcom",
    "Radcom",
    "1A.003:A1346851E393C7203C72284C284C14263C72",
    "https://radcom.com",
    "Telecom network analytics",
    "Tel Aviv",
  ),
  // Ashby
  ashby("lemonade", "Lemonade", "lemonade", "https://www.lemonade.com", "Insurtech", "New York"),
  ashby("moon-active", "Moon Active", "moonactive", "https://www.moonactive.com", "Mobile gaming"),
  ashby("honeybook", "HoneyBook", "honeybook", "https://www.honeybook.com", "SMB business management", "San Francisco"),
  // Careers site embeds Comeet without a usable public token, but the company also publishes its board on Ashby.
  ashby("wonderful", "Wonderful", "wonderful", "https://www.wonderful.ai", "Enterprise AI agents"),
  ashby("sisense", "Sisense", "sisense", "https://www.sisense.com", "Analytics / BI", "New York"),
  ashby("nexxen", "Nexxen", "nexxen", "https://www.nexxen.com", "AdTech"),
  ashby("zafran", "Zafran", "zafran-security", "https://www.zafran.io", "Exposure management"),
  ashby("snowflake", "Snowflake", "snowflake", "https://www.snowflake.com", "Data cloud", "Bozeman"),
  ashby(
    "chainalysis",
    "Chainalysis",
    "chainalysis-careers",
    "https://www.chainalysis.com",
    "Blockchain analytics",
    "New York",
  ),
  ashby("tavily", "Tavily", "tavily", "https://www.tavily.com", "AI search API"),
  ashby("unit", "Unit", "unit", "https://www.unit.co", "Embedded finance", "New York"),
  ashby("snappy", "Snappy", "snappy", "https://www.snappy.com", "Corporate gifting", "New York"),
  // Workable
  workable("nuvei", "Nuvei", "nuvei", "https://www.nuvei.com", "Payments", "Montreal"),
  workable("d-id", "D-ID", "d-id", "https://www.d-id.com", "Generative AI video"),
  // SmartRecruiters
  sr("armis", "Armis", "armis", "https://www.armis.com", "Asset / exposure security", "San Francisco"),
  sr("wix", "Wix", "Wix2", "https://www.wix.com", "Website builder"),
  // Recruitee
  recruitee("huuuge", "Huuuge Games", "huuuge", "https://huuugegames.com", "Mobile gaming", "Warsaw"),
  // Workday (Israel location facet only)
  workday("intel", "Intel", "intel/wd1/External", "https://www.intel.com", "Semiconductors", "Santa Clara"),
  workday(
    "nvidia",
    "NVIDIA",
    "nvidia/wd5/NVIDIAExternalCareerSite",
    "https://www.nvidia.com",
    "Semiconductors / AI",
    "Santa Clara",
  ),
  workday(
    "salesforce",
    "Salesforce",
    "salesforce/wd12/External_Career_Site",
    "https://www.salesforce.com",
    "CRM / SaaS",
    "San Francisco",
  ),
  workday("paypal", "PayPal", "paypal/wd1/jobs", "https://www.paypal.com", "Payments", "San Jose"),
  workday(
    "applied-materials",
    "Applied Materials",
    "amat/wd1/External",
    "https://www.appliedmaterials.com",
    "Semiconductor equipment",
    "Santa Clara",
  ),
  workday("kla", "KLA", "kla/wd1/Search", "https://www.kla.com", "Semiconductor equipment", "Milpitas"),
  workday(
    "marvell",
    "Marvell",
    "marvell/wd1/MarvellCareers",
    "https://www.marvell.com",
    "Semiconductors",
    "Wilmington",
  ),
  workday("hp", "HP", "hp/wd5/ExternalCareerSite", "https://www.hp.com", "Computing / printing", "Palo Alto"),
  workday("cadence", "Cadence", "cadence/wd1/External_Careers", "https://www.cadence.com", "EDA software", "San Jose"),
  workday("nxp", "NXP Semiconductors", "nxp/wd3/careers", "https://www.nxp.com", "Semiconductors", "Eindhoven"),
  workday(
    "mastercard",
    "Mastercard",
    "mastercard/wd1/CorporateCareers",
    "https://www.mastercard.com",
    "Payments",
    "Purchase, NY",
  ),
  workday("philips", "Philips", "philips/wd3/jobs-and-careers", "https://www.philips.com", "HealthTech", "Amsterdam"),
  workday(
    "medtronic",
    "Medtronic",
    "medtronic/wd1/MedtronicCareers",
    "https://www.medtronic.com",
    "Medical devices",
    "Dublin",
  ),
  workday(
    "johnson-and-johnson",
    "Johnson & Johnson",
    "jj/wd5/JJ",
    "https://www.jnj.com",
    "HealthTech / MedTech",
    "New Brunswick",
  ),
  workday(
    "crowdstrike",
    "CrowdStrike",
    "crowdstrike/wd5/crowdstrikecareers",
    "https://www.crowdstrike.com",
    "Cybersecurity",
    "Austin",
  ),
  workday(
    "motorola-solutions",
    "Motorola Solutions",
    "motorolasolutions/wd5/Careers",
    "https://www.motorolasolutions.com",
    "Public-safety technology",
    "Chicago",
  ),
  workday("autodesk", "Autodesk", "autodesk/wd1/Ext", "https://www.autodesk.com", "Design software", "San Francisco"),
  workday(
    "thales",
    "Thales",
    "thales/wd3/Careers",
    "https://www.thalesgroup.com",
    "Defense / aerospace / cyber",
    "Paris",
  ),
  workday(
    "palo-alto-networks",
    "Palo Alto Networks",
    "paloaltonetworks/wd5/panwexternalcareers",
    "https://www.paloaltonetworks.com",
    "Cybersecurity",
    "Santa Clara",
  ),
  workday("abbott", "Abbott", "abbott/wd5/abbottcareers", "https://www.abbott.com", "Medical devices", "Abbott Park"),
  workday(
    "samsung",
    "Samsung",
    "sec/wd3/Samsung_Careers",
    "https://www.samsung.com",
    "Electronics / semiconductors",
    "Suwon",
  ),
  workday(
    "ge-healthcare",
    "GE HealthCare",
    "gehc/wd5/GEHC_ExternalSite",
    "https://www.gehealthcare.com",
    "Medical imaging",
    "Chicago",
  ),
  workday("hpe", "Hewlett Packard Enterprise", "hpe/wd5/Jobsathpe", "https://www.hpe.com", "Enterprise IT", "Houston"),
  workday(
    "stryker",
    "Stryker",
    "stryker/wd1/StrykerCareers",
    "https://www.stryker.com",
    "Medical devices",
    "Kalamazoo",
  ),
  workday(
    "proofpoint",
    "Proofpoint",
    "proofpoint/wd5/proofpointcareers",
    "https://www.proofpoint.com",
    "Email / cyber security",
    "Sunnyvale",
  ),
  workday("micron", "Micron", "micron/wd1/External", "https://www.micron.com", "Memory semiconductors", "Boise"),
  workday(
    "workday",
    "Workday",
    "workday/wd5/Workday",
    "https://www.workday.com",
    "Enterprise HR / finance software",
    "Pleasanton",
  ),
  // Established employers (integrators, defense, finance) — see src/lib/companies/established.ts
  // Large employers whose HTML careers sites block bots: their search pages read public JSON APIs
  // (allowed by robots.txt), synced here with the identifiable job-hunt-bot User-Agent. The tenant was
  // matched to the company through its own careers page. See docs/sources.md ("Bot-protected sites").
  {
    ...eightfold(
      "amdocs",
      "Amdocs",
      "jobs.amdocs.com/amdocs.com",
      "https://www.amdocs.com",
      "Telecom software",
      "Ra'anana",
    ),
    careersUrl: "https://jobs.amdocs.com/careers",
  },
  {
    ...eightfold(
      "qualcomm",
      "Qualcomm",
      "careers.qualcomm.com/qualcomm.com",
      "https://www.qualcomm.com",
      "Semiconductors",
      "San Diego",
    ),
    careersUrl: "https://careers.qualcomm.com",
  },
  {
    ...eightfold(
      "microsoft",
      "Microsoft",
      "apply.careers.microsoft.com/microsoft.com",
      "https://www.microsoft.com",
      "Software & cloud",
      "Redmond",
    ),
    careersUrl: "https://careers.microsoft.com",
  },
  {
    ...oracle(
      "verint",
      "Verint",
      "fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/CX",
      "https://www.verint.com",
      "Customer engagement software",
      "Melville",
    ),
    careersUrl: "https://www.verint.com/en/careers/",
  },
  {
    ...oracle(
      "dell",
      "Dell Technologies",
      "enterpriseplatform.dell.com/CX_1001",
      "https://www.dell.com",
      "Computing hardware",
      "Round Rock",
    ),
    careersUrl: "https://jobs.dell.com",
  },
  {
    ...jibe("booking-com", "Booking.com", "jobs.booking.com", "https://www.booking.com", "Online travel", "Amsterdam"),
    careersUrl: "https://jobs.booking.com",
  },
  {
    ...src("AMAZON")("amazon", "Amazon", "ISR", "https://www.amazon.com", "E-commerce & cloud", "Seattle"),
    careersUrl: "https://www.amazon.jobs",
  },
  {
    ...workday("cisco", "Cisco", "cisco/wd5/Cisco_Careers", "https://www.cisco.com", "Networking", "San Jose"),
    careersUrl: "https://jobs.cisco.com",
  },
  {
    ...workday(
      "broadcom",
      "Broadcom",
      "broadcom/wd1/External_Career",
      "https://www.broadcom.com",
      "Semiconductors & infrastructure software",
      "Palo Alto",
    ),
    careersUrl: "https://www.broadcom.com/company/careers",
  },
  ...ESTABLISHED_SOURCES.map(withoutHub),
];
