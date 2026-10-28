import { describe, expect, it } from "vitest";
import { geocodeJob, parseLocation, placeByKey } from "@/lib/geo/geocode";

const keys = (s: string) => parseLocation(s).map((p) => p.key);

describe("parseLocation", () => {
  it("resolves canonical multi-city labels in order to hubs", () => {
    expect(keys("Yokneam / Tel Aviv")).toEqual(["hub:yokneam", "hub:tel-aviv"]);
    expect(keys("Herzliya / Tel Aviv / Ramat HaSharon")).toEqual([
      "hub:herzliya",
      "hub:tel-aviv",
      "hub:ramat-hasharon",
    ]);
  });

  it("parses Hebrew city names", () => {
    expect(keys("תל אביב-יפו")).toEqual(["hub:tel-aviv"]);
    expect(keys("רמת גן, ישראל")).toEqual(["hub:ramat-gan"]);
    expect(keys("פתח תקווה")).toEqual(["hub:petah-tikva"]);
    expect(keys("הרצליה פיתוח")).toEqual(["hub:herzliya"]);
    expect(keys("יוקנעם עילית")).toEqual(["hub:yokneam"]);
  });

  it("handles spellings outside the city list", () => {
    expect(keys("Nazareth Iliit")).toEqual(["hub:nof-hagalil"]);
    expect(keys("Giv'atayim")).toEqual(["hub:givatayim"]);
    expect(keys("Afek")).toEqual(["hub:afek"]);
    expect(keys("Rahat")).toEqual(["gn:rahat"]);
  });

  it("falls back to the GeoNames gazetteer (Latin and Hebrew)", () => {
    const tsurit = parseLocation("צורית")[0];
    expect(tsurit?.precision).toBe("city");
    expect(tsurit?.lat).toBeCloseTo(32.9, 1);
    expect(parseLocation("Beit Yanai")[0]?.lat).toBeCloseTo(32.38, 1);
  });

  it("returns nothing for country-only or remote text", () => {
    expect(keys("Israel")).toEqual([]);
    expect(keys("Remote - Israel")).toEqual([]);
    expect(keys("")).toEqual([]);
  });

  it("round-trips place keys", () => {
    for (const p of parseLocation("Haifa / Rahat")) expect(placeByKey(p.key)?.lat).toBe(p.lat);
  });
});

describe("geocodeJob", () => {
  it("uses the company HQ for country-only locations", () => {
    const g = geocodeJob("Israel", { id: "c1", hqLocation: "Petah Tikva, Israel" });
    expect(g.places.map((p) => p.key)).toEqual(["hub:petah-tikva"]);
    expect(g.precision).toBe("hq");
  });

  it("ignores foreign / remote HQs", () => {
    expect(geocodeJob("Israel", { id: "c1", hqLocation: "San Francisco" }).places).toEqual([]);
  });

  it("applies the office override to its city only", () => {
    const g = geocodeJob("Tel Aviv / Haifa", {
      id: "c1",
      officeLat: 32.1,
      officeLng: 34.8,
      officeAddress: "Menachem Begin 1",
      officeCity: "Haifa",
    });
    expect(g.places.map((p) => p.key)).toEqual(["hub:tel-aviv", "co:c1"]);
  });
});
