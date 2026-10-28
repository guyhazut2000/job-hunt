/** Israeli city canonicalization (English + Hebrew spellings seen on ATS boards). */
export const CITIES: [label: string, re: RegExp][] = [
  ["Tel Aviv", /tel[\s-]?aviv|תל[\s-]?אביב|\btlv\b/i],
  ["Herzliya", /herz[e]?l?iy?ah?|הרצליה/i],
  ["Ramat Gan", /ramat[\s-]?gan|רמת[\s-]?גן/i],
  ["Petah Tikva", /pet(?:a|ah|ach)[\s-]?ti[kq]v?v?a|פתח[\s-]?תקוו?ה/i],
  ["Haifa", /haifa|חיפה/i],
  ["Jerusalem", /jerusalem|ירושלים/i],
  ["Be'er Sheva", /be'?er[\s-]?sheva|beersheba|באר[\s-]?שבע/i],
  ["Ra'anana", /ra'?anana|רעננה/i],
  ["Netanya", /netanya|נתניה/i],
  ["Yokneam", /yo[kq]ne?'?am|יקנעם/i],
  ["Rehovot", /rehovot|רחובות/i],
  ["Hod Hasharon", /hod[\s-]?hasharon|הוד[\s-]?השרון/i],
  ["Kfar Saba", /k(?:e)?far[\s-]?sa[bv]a|כפר[\s-]?סבא/i],
  ["Rosh HaAyin", /rosh[\s-]?ha'?ayin|ראש[\s-]?העין/i],
  ["Caesarea", /caesarea|קיסריה/i],
  ["Or Yehuda", /or[\s-]?yehuda|אור[\s-]?יהודה/i],
  ["Airport City", /airport[\s-]?city|קריית[\s-]?שדה[\s-]?התעופה/i],
  ["Modi'in", /modi'?in|מודיעין/i],
  ["Givatayim", /givatayim|גבעתיים/i],
  ["Bnei Brak", /bnei[\s-]?brak|בני[\s-]?ברק/i],
  ["Holon", /holon|חולון/i],
  ["Rishon LeZion", /rishon|ראשון[\s-]?לציון/i],
  ["Lod", /\blod\b|לוד/i],
  ["Kiryat Gat", /kiryat[\s-]?gat|קריית[\s-]?גת/i],
  ["Ness Ziona", /ne(?:s|ss)[\s-]?ziona|נס[\s-]?ציונה/i],
  ["Yavne", /\byavne\b|יבנה/i],
  ["Ashdod", /ashdod|אשדוד/i],
  ["Ashkelon", /ashkelon|אשקלון/i],
  ["Hadera", /hadera|חדרה/i],
  ["Karmiel", /karmiel|כרמיאל/i],
  ["Migdal HaEmek", /migdal[\s-]?ha'?emek|מגדל[\s-]?העמק/i],
  ["Tel Hai", /tel[\s-]?hai|תל[\s-]?חי/i],
  ["Kiryat Shmona", /kiryat[\s-]?shmona|קריית[\s-]?שמונה/i],
  ["Ramat HaSharon", /ramat[\s-]?hasharon|רמת[\s-]?השרון/i],
  ["Yehud", /\byehud\b|יהוד(?!ה)/i],
  ["Shefayim", /shefayim|שפיים/i],
  ["Zichron Ya'akov", /zi[ck]h?ron[\s-]?ya'?akov|זכרון[\s-]?יעקב/i],
  ["Beit Shemesh", /beit[\s-]?shemesh|בית[\s-]?שמש/i],
  ["Misgav", /\bmisgav\b|משגב/i],
];

export const COUNTRY = /israel|ישראל|\bisr\b/i;

/** True when a free-text ATS location refers to Israel (any Israeli city, or "Israel" / "Remote - Israel"). */
export function isIsraelLocation(location: string | null | undefined): boolean {
  if (!location) return false;
  return COUNTRY.test(location) || CITIES.some(([, re]) => re.test(location));
}

/**
 * Canonical display location: Israeli cities in order of appearance, joined with " / ".
 * Falls back to "Israel" for country-only strings and to the trimmed original otherwise.
 */
export function normalizeLocation(...locations: (string | null | undefined)[]): string {
  const text = locations.filter(Boolean).join(" ; ");
  const found = CITIES.map(([label, re]) => ({ label, idx: text.search(re) }))
    .filter((c) => c.idx >= 0)
    .sort((a, b) => a.idx - b.idx)
    .map((c) => c.label);
  if (found.length) return [...new Set(found)].join(" / ");
  if (COUNTRY.test(text)) return "Israel";
  return locations.find((l) => l?.trim())?.trim() ?? "Israel";
}
