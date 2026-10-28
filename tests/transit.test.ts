import { describe, expect, it } from "vitest";
import { MODES, parseMode } from "@/lib/commute/keys";
import { legKind, parseTransitMatrix, pickItinerary, toRoute, transitMatrixUrl } from "@/lib/commute/transitous";
import { commuteText } from "@/components/map/CommuteChips";
import { jobsMapStrings, legsSummary } from "@/lib/i18n/jobs-map";

// Pure helpers only: no network (provider calls are never made from tests).

describe("combined public transport mode", () => {
  it("replaces bus/train with one transit mode, mapping old URLs", () => {
    expect(MODES).toEqual(["car", "transit"]);
    expect(parseMode("bus")).toBe("transit");
    expect(parseMode("train")).toBe("transit");
    expect(parseMode("car")).toBe("car");
    expect(parseMode("plane")).toBeUndefined();
  });

  it("asks the matrix for every transit mode with transfers, walking and a 5 h window", () => {
    const url = new URL(
      transitMatrixUrl(
        { lat: 32.82, lng: 34.998 },
        [
          { lat: 31.25, lng: 34.79 },
          { lat: 32.08, lng: 34.78 },
        ],
        new Date("2026-11-01T06:30:00Z"),
        "https://example.test",
      ),
    );
    expect(url.pathname).toBe("/api/experimental/one-to-many-intermodal");
    expect(url.searchParams.get("transitModes")).toBe("TRANSIT");
    expect(url.searchParams.get("maxTravelTime")).toBe("300");
    expect(url.searchParams.get("maxTransfers")).toBe("4");
    expect(url.searchParams.get("maxPreTransitTime")).toBe("1500");
    expect(url.searchParams.get("maxPostTransitTime")).toBe("1500");
    expect(url.searchParams.get("time")).toBe("2026-11-01T06:30:00.000Z");
    expect(url.searchParams.get("many")).toBe("31.25000;34.79000,32.08000;34.78000");
  });

  it("parses the matrix: fastest option, then fewer transfers; walk if faster; null if none", () => {
    const out = parseTransitMatrix(
      {
        transit_durations: [
          [
            { duration: 5400, transfers: 2 },
            { duration: 5400, transfers: 1 },
            { duration: 6000, transfers: 0 },
          ],
          [{ duration: 900, transfers: 0 }],
          [],
        ],
        street_durations: [{}, { duration: 600 }, {}],
      },
      3,
    );
    expect(out).toEqual([{ seconds: 5400, transfers: 1 }, { seconds: 600, transfers: 0 }, { seconds: null }]);
    expect(() => parseTransitMatrix({ transit_durations: [] }, 2)).toThrow();
  });
});

const itinerary = {
  duration: 5220,
  transfers: 1,
  startTime: "2026-11-01T06:36:00Z",
  endTime: "2026-11-01T08:03:00Z",
  legs: [
    { mode: "WALK", duration: 240 },
    { mode: "BUS", duration: 900, routeShortName: "18" },
    { mode: "WALK", duration: 200 },
    { mode: "WALK", duration: 30 },
    { mode: "REGIONAL_RAIL", duration: 3300, routeShortName: "באר שבע מרכז <-> נהריה" },
    { mode: "WALK", duration: 20 },
  ],
};

describe("itinerary legs", () => {
  it("maps MOTIS modes to leg kinds", () => {
    expect(legKind("BUS")).toBe("bus");
    expect(legKind("COACH")).toBe("bus");
    expect(legKind("REGIONAL_RAIL")).toBe("rail");
    expect(legKind("TRAM")).toBe("light_rail");
    expect(legKind("WALK")).toBe("walk");
    expect(legKind("FERRY")).toBe("other");
  });

  it("merges walks, keeps bus numbers, drops long rail names and sub-minute walks", () => {
    const r = toRoute(itinerary)!;
    expect(r.legs).toEqual([
      { kind: "walk", seconds: 240 },
      { kind: "bus", seconds: 900, line: "18" },
      { kind: "walk", seconds: 230 },
      { kind: "rail", seconds: 3300 },
    ]);
    expect(r.transfers).toBe(1);
    expect(r.walkSeconds).toBe(490);
    expect(r.seconds).toBe(5220);
  });

  it("picks the earliest arrival, then fewer transfers, ignoring walk-only itineraries", () => {
    const later = { ...itinerary, endTime: "2026-11-01T08:30:00Z", transfers: 0 };
    const sameTimeMoreTransfers = { ...itinerary, transfers: 3 };
    const walkOnly = { ...itinerary, endTime: "2026-11-01T07:00:00Z", legs: [{ mode: "WALK", duration: 9000 }] };
    expect(pickItinerary([later, sameTimeMoreTransfers, itinerary, walkOnly])?.transfers).toBe(1);
    expect(pickItinerary([])).toBeNull();
  });

  it("summarises legs in both languages with a direction-aware arrow", () => {
    const legs = toRoute(itinerary)!.legs;
    expect(legsSummary(legs, jobsMapStrings("he"))).toBe("אוטובוס 18 ← רכבת");
    expect(legsSummary(legs, jobsMapStrings("en"))).toBe("Bus 18 → Train");
  });
});

describe("chips", () => {
  it("never says unreachable for an estimate: shows ≈ time", () => {
    const he = jobsMapStrings("he");
    expect(commuteText("transit", { seconds: 2700, source: "estimate", estimateReason: "no-route" }, he)).toBe(
      "≈ 45 דק׳",
    );
    expect(commuteText("transit", { seconds: 2700, source: "transitous" }, jobsMapStrings("en"))).toBe("45 min");
    expect(jobsMapStrings("he").modes.transit).toBe("תחבורה ציבורית");
    expect(jobsMapStrings("en").modes.transit).toBe("Public transport");
  });
});
