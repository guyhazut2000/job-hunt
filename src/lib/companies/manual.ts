/**
 * Companies with an Israeli office that we can't sync automatically: their careers site runs on an
 * ATS without a public job-board API (Oracle, SuccessFactors, Eightfold, Phenom, in-house…), their
 * public feed doesn't answer reliably, or it currently lists no Israeli openings. They are never dropped: the app lists
 * them with a link to their own careers page so they can be checked by hand.
 *
 * Every `careersUrl` is the company's official careers site (never LinkedIn) and was checked to load
 * on 2026-10-27. Seeded with `syncManualCompanies()` (create-only, admin edits are kept).
 */
export interface ManualCompany {
  slug: string;
  name: string;
  website: string;
  careersUrl: string;
  industry: string;
  hqLocation: string;
  notesHe?: string;
  notesEn?: string;
}

const NO_FEED_HE = "אתר המשרות לא מפרסם API ציבורי — בדקו משרות בישראל ישירות באתר.";
const NO_FEED_EN = "The careers site has no public job feed — check Israeli openings on the site directly.";
const NO_IL_HE = "בזמן הבדיקה לא פורסמו משרות בישראל בפיד הציבורי — כדאי לבדוק מדי פעם באתר.";
const NO_IL_EN = "Its public feed listed no Israeli openings when last checked — worth checking the site now and then.";

const m = (
  slug: string,
  name: string,
  website: string,
  careersUrl: string,
  industry: string,
  hqLocation: string,
  notesHe = NO_FEED_HE,
  notesEn = NO_FEED_EN,
): ManualCompany => ({ slug, name, website, careersUrl, industry, hqLocation, notesHe, notesEn });

export const MANUAL_COMPANIES: ManualCompany[] = [
  m(
    "broadcom",
    "Broadcom",
    "https://www.broadcom.com",
    "https://www.broadcom.com/company/careers",
    "Semiconductors & infrastructure software",
    "Palo Alto",
  ),
  m("amdocs", "Amdocs", "https://www.amdocs.com", "https://jobs.amdocs.com/careers", "Telecom software", "Ra'anana"),
  m("dell", "Dell Technologies", "https://www.dell.com", "https://jobs.dell.com", "Computing hardware", "Round Rock"),
  m(
    "check-point",
    "Check Point",
    "https://www.checkpoint.com",
    "https://careers.checkpoint.com",
    "Cybersecurity",
    "Tel Aviv",
  ),
  m(
    "elbit-systems",
    "Elbit Systems",
    "https://elbitsystems.com",
    "https://elbitsystemscareer.com",
    "Defense electronics",
    "Haifa",
  ),
  m("varonis", "Varonis", "https://www.varonis.com", "https://careers.varonis.com", "Data security", "New York"),
  m(
    "verint",
    "Verint",
    "https://www.verint.com",
    "https://www.verint.com/en/careers/",
    "Customer engagement software",
    "Melville",
  ),
  m(
    "tower-semiconductor",
    "Tower Semiconductor",
    "https://towersemi.com",
    "https://careers.towersemi.com/",
    "Semiconductors",
    "Migdal HaEmek",
  ),
  m(
    "monday-com",
    "monday.com",
    "https://monday.com",
    "https://monday.com/careers",
    "Work management software",
    "Tel Aviv",
  ),
  m("intuit", "Intuit", "https://www.intuit.com", "https://jobs.intuit.com", "Financial software", "Mountain View"),
  m("synopsys", "Synopsys", "https://www.synopsys.com", "https://careers.synopsys.com", "EDA software", "Sunnyvale"),
  m("sandisk", "Sandisk", "https://www.sandisk.com", "https://www.sandisk.com/careers", "Flash storage", "Milpitas"),
  m("cisco", "Cisco", "https://www.cisco.com", "https://jobs.cisco.com", "Networking", "San Jose"),
  m("unity", "Unity", "https://unity.com", "https://unity.com/careers", "Game engine & AdTech", "San Francisco"),
  m("akamai", "Akamai", "https://www.akamai.com", "https://www.akamai.com/careers", "CDN & security", "Cambridge"),
  m(
    "dynatrace",
    "Dynatrace",
    "https://www.dynatrace.com",
    "https://www.dynatrace.com/careers/",
    "Observability",
    "Waltham",
  ),
  m("rapid7", "Rapid7", "https://www.rapid7.com", "https://careers.rapid7.com", "Cybersecurity", "Boston"),
  m(
    "microsoft",
    "Microsoft",
    "https://www.microsoft.com",
    "https://careers.microsoft.com",
    "Software & cloud",
    "Redmond",
  ),
  m("apple", "Apple", "https://www.apple.com", "https://jobs.apple.com", "Consumer electronics", "Cupertino"),
  m("amazon", "Amazon", "https://www.amazon.com", "https://www.amazon.jobs", "E-commerce & cloud", "Seattle"),
  m("meta", "Meta", "https://about.meta.com", "https://www.metacareers.com", "Social media & AI", "Menlo Park"),
  m("qualcomm", "Qualcomm", "https://www.qualcomm.com", "https://careers.qualcomm.com", "Semiconductors", "San Diego"),
  m("booking-com", "Booking.com", "https://www.booking.com", "https://jobs.booking.com", "Online travel", "Amsterdam"),
  m("zoom", "Zoom", "https://www.zoom.com", "https://careers.zoom.us", "Video communications", "San Jose"),
  m(
    "teva",
    "Teva",
    "https://www.tevapharm.com",
    "https://www.tevapharm.com/your-career/",
    "Pharmaceuticals",
    "Tel Aviv",
  ),
  m("sapiens", "Sapiens", "https://sapiens.com", "https://sapiens.careers.hibob.com/", "Insurance software", "Holon"),
  m(
    "lightricks",
    "Lightricks",
    "https://www.lightricks.com",
    "https://careers.lightricks.com/",
    "Creative AI apps",
    "Jerusalem",
  ),
  m("hibob", "HiBob", "https://www.hibob.com", "https://www.hibob.com/careers/", "HR software", "Tel Aviv"),
  m("nova", "Nova", "https://www.novami.com", "https://www.novami.com/careers/", "Semiconductor metrology", "Rehovot"),
  // Dropped earlier because their public feed had no Israeli openings — kept visible instead.
  m(
    "hippo",
    "Hippo",
    "https://www.hippo.com",
    "https://www.hippo.com/careers",
    "Insurtech",
    "Palo Alto",
    NO_IL_HE,
    NO_IL_EN,
  ),
  m("snyk", "Snyk", "https://snyk.io", "https://snyk.io/careers/", "Developer security", "Boston", NO_IL_HE, NO_IL_EN),
  m(
    "vayyar",
    "Vayyar",
    "https://vayyar.com",
    "https://vayyar.com/careers/",
    "4D imaging radar",
    "Yehud",
    NO_IL_HE,
    NO_IL_EN,
  ),
];
