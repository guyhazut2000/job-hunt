// Builds src/lib/geo/il-places.json from the GeoNames Israel dump (CC BY 4.0, https://www.geonames.org).
// Usage: curl -O https://download.geonames.org/export/dump/IL.zip && unzip IL.zip && node scripts/build-gazetteer.mjs IL.txt
import fs from "node:fs";

const file = process.argv[2] ?? "IL.txt";
const KEEP = new Set(["PPL", "PPLA", "PPLA2", "PPLA3", "PPLC", "PPLL", "PPLX", "STLMT", "PPLQ"]);
const HEBREW = /[\u0590-\u05FF]/;
const LATIN = /^[A-Za-z' \-`’‘]+$/;
const norm = (s) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u0591-\u05C7]/g, "")
    .replace(/[\u05BE\-–]/g, " ")
    .replace(/[`’‘׳']/g, "'")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const out = [];
for (const line of fs.readFileSync(file, "utf8").split("\n")) {
  const c = line.split("\t");
  if (c.length < 15 || c[6] !== "P" || !KEEP.has(c[7])) continue;
  if (c[7] === "PPLQ") continue; // abandoned places
  const alts = c[3] ? c[3].split(",") : [];
  const he = alts
    .filter((a) => HEBREW.test(a) && !/[\u0591-\u05C7]/.test(a))
    .concat(alts.filter((a) => HEBREW.test(a)).map((a) => a.replace(/[\u0591-\u05C7]/g, "")));
  // Latin alternates only when they look like spellings of the main name (GeoNames also lists historic
  // names such as "Ariel" for Jerusalem, which would mis-geocode other places).
  const base = norm(c[2] || c[1]).slice(0, 3);
  const latin = alts.filter((a) => LATIN.test(a) && a.length >= 3 && norm(a).startsWith(base));
  const aliases = [...new Set([c[1], c[2], ...he, ...latin].map(norm).filter((a) => a.length >= 2))].slice(0, 16);
  if (!aliases.length) continue;
  out.push({
    n: c[2] || c[1],
    he: he[0] ?? null,
    lat: Math.round(Number(c[4]) * 1e5) / 1e5,
    lng: Math.round(Number(c[5]) * 1e5) / 1e5,
    pop: Number(c[14]) || 0,
    x: c[7] === "PPLX" ? 1 : 0,
    a: aliases,
  });
}
out.sort((a, b) => b.pop - a.pop);
fs.writeFileSync(new URL("../src/lib/geo/il-places.json", import.meta.url), JSON.stringify(out));
console.log(`wrote ${out.length} places`);
