/**
 * Curated coordinates for the places jobs are listed in.
 *
 * ATS boards only give a city, so a job is pinned to where that city's tech employers actually sit
 * (Herzliya -> the Pituach industrial zone, Haifa -> Matam, ...) rather than to the city centre, which
 * makes commute estimates closer to reality. Everything else falls back to the GeoNames gazetteer
 * (city centroid). All points are approximate and labelled as such in the UI.
 *
 * Hub points were looked up once in OpenStreetMap (Nominatim) and are kept here so nothing is
 * geocoded at request time.
 */
export interface Hub {
  /** Stable key used in Job.geoPlaces and cache keys. */
  key: string;
  /** Canonical city label (matches src/lib/ingestion/location.ts). */
  label: string;
  he: string;
  lat: number;
  lng: number;
  /** Where the pin is, when it is a business district rather than the city centre. */
  area?: { en: string; he: string };
}

const hub = (key: string, label: string, he: string, lat: number, lng: number, area?: [string, string]): Hub => ({
  key: `hub:${key}`,
  label,
  he,
  lat,
  lng,
  area: area ? { en: area[0], he: area[1] } : undefined,
});

export const HUBS: Hub[] = [
  hub("tel-aviv", "Tel Aviv", "תל אביב", 32.0745, 34.792, ["Azrieli / Sarona", "עזריאלי / שרונה"]),
  hub("herzliya", "Herzliya", "הרצליה", 32.1662, 34.8128, [
    "Herzliya Pituach industrial zone",
    "אזור התעשייה הרצליה פיתוח",
  ]),
  hub("ramat-gan", "Ramat Gan", "רמת גן", 32.0857, 34.8022, ["Diamond Exchange (Bursa)", "הבורסה"]),
  hub("petah-tikva", "Petah Tikva", "פתח תקווה", 32.0975, 34.8555, [
    "Kiryat Aryeh / Kiryat Matalon",
    "קריית אריה / קריית מטלון",
  ]),
  hub("haifa", "Haifa", "חיפה", 32.7904, 34.9613, ["Matam", "מת״ם"]),
  hub("jerusalem", "Jerusalem", "ירושלים", 31.8017, 35.2097, ["Har Hotzvim", "הר חוצבים"]),
  hub("beer-sheva", "Be'er Sheva", "באר שבע", 31.2638, 34.813, ["Gav-Yam Negev", "גב-ים נגב"]),
  hub("raanana", "Ra'anana", "רעננה", 32.1836, 34.8739),
  hub("netanya", "Netanya", "נתניה", 32.3329, 34.8592),
  hub("yokneam", "Yokneam", "יוקנעם", 32.6578, 35.0979, ["Yokneam Illit high-tech park", "פארק ההייטק יוקנעם עילית"]),
  hub("rehovot", "Rehovot", "רחובות", 31.9072, 34.809, ["Science Park", "פארק המדע"]),
  hub("hod-hasharon", "Hod Hasharon", "הוד השרון", 32.1556, 34.9214, ["Industrial zone", "אזור התעשייה"]),
  hub("kfar-saba", "Kfar Saba", "כפר סבא", 32.1783, 34.9269, ["Industrial zone", "אזור התעשייה"]),
  hub("rosh-haayin", "Rosh HaAyin", "ראש העין", 32.1031, 34.9581, ["Park Afek", "פארק אפק"]),
  hub("caesarea", "Caesarea", "קיסריה", 32.5189, 34.9046),
  hub("or-yehuda", "Or Yehuda", "אור יהודה", 32.0294, 34.8528),
  hub("airport-city", "Airport City", "איירפורט סיטי", 31.9889, 34.9128),
  hub("modiin", "Modi'in", "מודיעין", 31.8939, 35.015),
  hub("givatayim", "Givatayim", "גבעתיים", 32.0723, 34.8125),
  hub("bnei-brak", "Bnei Brak", "בני ברק", 32.0807, 34.8338),
  hub("holon", "Holon", "חולון", 32.0167, 34.8046, ["Industrial zone", "אזור התעשייה"]),
  hub("rishon-lezion", "Rishon LeZion", "ראשון לציון", 31.971, 34.7894),
  hub("lod", "Lod", "לוד", 31.9526, 34.8917),
  hub("kiryat-gat", "Kiryat Gat", "קריית גת", 31.6048, 34.7846, ["Industrial zone", "אזור התעשייה"]),
  hub("ness-ziona", "Ness Ziona", "נס ציונה", 31.9165, 34.8043, ["Science Park", "פארק המדע"]),
  hub("yavne", "Yavne", "יבנה", 31.8671, 34.7454, ["Industrial zone", "אזור התעשייה"]),
  hub("ashdod", "Ashdod", "אשדוד", 31.7921, 34.6497),
  hub("ashkelon", "Ashkelon", "אשקלון", 31.6693, 34.5715),
  hub("hadera", "Hadera", "חדרה", 32.4419, 34.9039),
  hub("karmiel", "Karmiel", "כרמיאל", 32.9095, 35.2977),
  hub("migdal-haemek", "Migdal HaEmek", "מגדל העמק", 32.6872, 35.2509, [
    "Ramat Gavriel industrial zone",
    "אזור התעשייה רמת גבריאל",
  ]),
  hub("tel-hai", "Tel Hai", "תל חי", 33.236, 35.5782),
  hub("kiryat-shmona", "Kiryat Shmona", "קריית שמונה", 33.2073, 35.5721),
  hub("ramat-hasharon", "Ramat HaSharon", "רמת השרון", 32.1459, 34.8386),
  hub("yehud", "Yehud", "יהוד", 32.0325, 34.8884),
  hub("shefayim", "Shefayim", "שפיים", 32.2175, 34.825),
  hub("zichron-yaakov", "Zichron Ya'akov", "זכרון יעקב", 32.5707, 34.9536),
  hub("beit-shemesh", "Beit Shemesh", "בית שמש", 31.7307, 34.9929),
  hub("misgav", "Misgav", "משגב", 32.8592, 35.2603),
  // Places ATS boards spell in ways the city list does not catch.
  hub("afek", "Afek", "אפק", 32.1031, 34.9581, ["Park Afek, Rosh HaAyin", "פארק אפק, ראש העין"]),
  hub("nof-hagalil", "Nof HaGalil", "נוף הגליל", 32.7082, 35.3247),
  hub("kinneret", "Kinneret", "כנרת", 32.7207, 35.5627),
  hub("beit-haemek", "Beit HaEmek", "בית העמק", 32.9672, 35.1428),
];

/** Extra spellings that map onto a hub (normalized, see normText). */
export const HUB_ALIASES: Record<string, string> = {
  "nazareth iliit": "hub:nof-hagalil",
  "nazareth illit": "hub:nof-hagalil",
  "nazrat illit": "hub:nof-hagalil",
  "נצרת עילית": "hub:nof-hagalil",
  "נוף הגליל": "hub:nof-hagalil",
  "nof hagalil": "hub:nof-hagalil",
  "giv'atayim": "hub:givatayim",
  givataim: "hub:givatayim",
  afek: "hub:afek",
  "park afek": "hub:afek",
  kinneret: "hub:kinneret",
  "beit haemek": "hub:beit-haemek",
  "beit ha'emek": "hub:beit-haemek",
  "בית העמק": "hub:beit-haemek",
  "herzliya pituach": "hub:herzliya",
  "הרצליה פיתוח": "hub:herzliya",
  matam: "hub:haifa",
  "har hotzvim": "hub:jerusalem",
  "yokneam illit": "hub:yokneam",
  יוקנעם: "hub:yokneam",
  "יוקנעם עילית": "hub:yokneam",
  "תל אביב יפו": "hub:tel-aviv",
};

export const HUB_BY_KEY = new Map(HUBS.map((h) => [h.key, h]));
export const HUB_BY_LABEL = new Map(HUBS.map((h) => [h.label, h]));
