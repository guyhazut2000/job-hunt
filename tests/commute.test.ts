import { describe, expect, it } from "vitest";
import { filterByCommute, jobCommuteSeconds, sortByCommute } from "@/lib/commute/filter";
import {
  DEFAULT_DEPARTURE,
  departureKey,
  destKey,
  isPeak,
  nextDeparture,
  parseDeparture,
  parseLatLng,
  roundOrigin,
  trafficFactor,
} from "@/lib/commute/keys";
import { estimateCommute } from "@/lib/commute/estimate";
import { mergeBest } from "@/lib/commute/jobs";
import type { CommuteResult } from "@/lib/commute/types";
import { buildMarkers, type MarkerRow } from "@/lib/geo/map-markers";
import { parseFilters, clearedFilters } from "@/lib/jobs/filters";

describe("cache keys", () => {
  it("rounds origins to the ~200 m grid so nearby users share a key", () => {
    const a = roundOrigin({ lat: 32.07312, lng: 34.79251 });
    const b = roundOrigin({ lat: 32.0735, lng: 34.7921 });
    expect(a.key).toBe("32.074,34.792");
    expect(b.key).toBe(a.key);
    expect(roundOrigin({ lat: 32.0762, lng: 34.7925 }).key).not.toBe(a.key);
    // never more than half a grid cell (~110 m) from the real point
    expect(Math.abs(a.lat - 32.07312)).toBeLessThanOrEqual(0.001);
  });

  it("keys destinations at 4 decimals", () => {
    expect(destKey({ lat: 32.16234567, lng: 34.8065 })).toBe("32.1623,34.8065");
  });

  it("parses lat,lng params only inside the service area", () => {
    expect(parseLatLng("32.074,34.792")).toEqual({ lat: 32.074, lng: 34.792 });
    expect(parseLatLng(" 32.074 , 34.792 ")).toEqual({ lat: 32.074, lng: 34.792 });
    expect(parseLatLng("40.7,-74")).toBeNull();
    expect(parseLatLng("32.07;34.79")).toBeNull();
    expect(parseLatLng(undefined)).toBeNull();
  });

  it("buckets departures on the 30-minute grid", () => {
    expect(parseDeparture("fri-0945")).toEqual({ day: "fri", minutes: 9 * 60 + 30 });
    expect(departureKey(parseDeparture("sun-thu-1714"))).toBe("sun-thu-1700");
    expect(parseDeparture("mon-0800")).toEqual(DEFAULT_DEPARTURE);
    expect(parseDeparture("sat-2575")).toEqual(DEFAULT_DEPARTURE);
    expect(departureKey(DEFAULT_DEPARTURE)).toBe("sun-thu-0830");
  });
});

describe("nextDeparture (Israel time)", () => {
  it("defaults to the next workday at 08:30", () => {
    // Wed 2026-10-28 10:00 Israel (UTC+2) -> Thu 29th 08:30 = 06:30Z
    expect(nextDeparture(DEFAULT_DEPARTURE, new Date("2026-10-28T08:00:00Z")).toISOString()).toBe(
      "2026-10-29T06:30:00.000Z",
    );
    // Thu evening -> skips Fri/Sat -> Sun 1 Nov
    expect(nextDeparture(DEFAULT_DEPARTURE, new Date("2026-10-29T18:00:00Z")).toISOString()).toBe(
      "2026-11-01T06:30:00.000Z",
    );
    // same-day when still ahead: Wed 07:00 Israel
    expect(nextDeparture(DEFAULT_DEPARTURE, new Date("2026-10-28T05:00:00Z")).toISOString()).toBe(
      "2026-10-28T06:30:00.000Z",
    );
  });

  it("handles summer time (UTC+3)", () => {
    expect(nextDeparture(DEFAULT_DEPARTURE, new Date("2026-07-01T12:00:00Z")).toISOString()).toBe(
      "2026-07-02T05:30:00.000Z",
    );
    expect(nextDeparture({ day: "sat", minutes: 600 }, new Date("2026-07-01T12:00:00Z")).toISOString()).toBe(
      "2026-07-04T07:00:00.000Z",
    );
  });

  it("applies traffic only to Sun–Thu peaks", () => {
    expect(isPeak(DEFAULT_DEPARTURE)).toBe(true);
    expect(isPeak({ day: "sun-thu", minutes: 12 * 60 })).toBe(false);
    expect(trafficFactor({ day: "fri", minutes: 510 })).toBeLessThan(trafficFactor(DEFAULT_DEPARTURE));
  });
});

describe("estimate fallback", () => {
  it("is slower by bus than by car and labelled as an estimate", () => {
    const o = { lat: 32.0731, lng: 34.7925 };
    const d = { lat: 32.1623, lng: 34.8065 };
    const car = estimateCommute(o, d, "car", DEFAULT_DEPARTURE);
    const bus = estimateCommute(o, d, "bus", DEFAULT_DEPARTURE);
    expect(car.source).toBe("estimate");
    expect(car.seconds!).toBeGreaterThan(5 * 60);
    expect(bus.seconds!).toBeGreaterThan(car.seconds!);
  });
});

const r = (car: number | null, bus: number | null, train?: number | null): CommuteResult => ({
  car: { seconds: car, source: "transitous" },
  bus: { seconds: bus, source: "transitous" },
  ...(train === undefined ? {} : { train: { seconds: train, source: "transitous" as const } }),
});

describe("commute filter & sort", () => {
  const times = new Map<string, CommuteResult>([
    ["hub:herzliya", r(1200, 2400, 1800)],
    ["hub:haifa", r(5400, 7200, 6000)],
    ["hub:tel-aviv", r(600, 900, null)],
  ]);
  const jobs = [
    { id: "a", places: ["hub:haifa"] },
    { id: "b", places: ["hub:herzliya", "hub:haifa"] },
    { id: "c", places: [] },
    { id: "d", places: ["hub:tel-aviv"] },
  ];

  it("uses a multi-city job's fastest place and the chosen mode", () => {
    expect(jobCommuteSeconds(["hub:herzliya", "hub:haifa"], times)).toBe(1200);
    expect(jobCommuteSeconds(["hub:herzliya", "hub:haifa"], times, "bus")).toBe(2400);
    expect(jobCommuteSeconds(["hub:tel-aviv"], times, "train")).toBeNull();
    expect(jobCommuteSeconds([], times)).toBeNull();
  });

  it("drops jobs over the max (and jobs with no route) and sorts unknowns last", () => {
    const secs = (j: (typeof jobs)[number]) => jobCommuteSeconds(j.places, times, "train");
    expect(filterByCommute(jobs, secs, 45).map((j) => j.id)).toEqual(["b"]);
    expect(filterByCommute(jobs, secs, null)).toHaveLength(4);
    const all = (j: (typeof jobs)[number]) => jobCommuteSeconds(j.places, times);
    expect(sortByCommute(jobs, all).map((j) => j.id)).toEqual(["d", "b", "a", "c"]);
  });

  it("mergeBest keeps the fastest value per mode", () => {
    const m = mergeBest([r(1200, null), r(1500, 2000), undefined]);
    expect(m.car?.seconds).toBe(1200);
    expect(m.bus?.seconds).toBe(2000);
  });
});

describe("map filters", () => {
  it("parses map/origin params and rounds ad-hoc points", () => {
    const f = parseFilters({ view: "map", from: "32.07312,34.79251", cmode: "bus", maxc: "45", dep: "fri-0900" });
    expect(f.view).toBe("map");
    expect(f.from).toBe("32.074,34.792");
    expect(f.cmode).toBe("bus");
    expect(f.maxc).toBe(45);
    expect(f.dep).toBe("fri-0900");
  });

  it("ignores junk and the default departure", () => {
    const f = parseFilters({
      view: "globe",
      from: "1,2",
      cmode: "plane",
      maxc: "37",
      dep: "sun-thu-0830",
      origin: "x;y",
    });
    expect(f.view).toBeUndefined();
    expect(f.from).toBeUndefined();
    expect(f.cmode).toBeUndefined();
    expect(f.maxc).toBeUndefined();
    expect(f.dep).toBeUndefined();
    expect(f.origin).toBeUndefined();
    expect(parseFilters({ origin: "none" }).origin).toBe("none");
  });

  it("clearing filters keeps the view and origin but drops max commute", () => {
    const c = clearedFilters(parseFilters({ view: "map", from: "32.074,34.792", maxc: "30", role: "BACKEND" }));
    expect(c.view).toBe("map");
    expect(c.from).toBe("32.074,34.792");
    expect(c.maxc).toBeUndefined();
  });
});

describe("buildMarkers", () => {
  const company = (id: string) => ({
    id,
    name: id.toUpperCase(),
    slug: id,
    hqLocation: null,
    officeAddress: null,
    officeLat: null,
    officeLng: null,
    officeCity: null,
  });
  const row = (id: string, co: string, places: string[], workMode: MarkerRow["workMode"] = "HYBRID"): MarkerRow => ({
    id,
    title: `Job ${id}`,
    workMode,
    geoPlaces: places,
    geoPrecision: "hub",
    company: company(co),
  });

  it("groups by company office, excludes remote, counts unmapped", () => {
    const { markers, remote, unmapped } = buildMarkers(
      [
        row("1", "acme", ["hub:herzliya"]),
        row("2", "acme", ["hub:herzliya", "hub:tel-aviv"], "ONSITE"),
        row("3", "beta", ["hub:herzliya"]),
        row("4", "beta", ["hub:herzliya"], "REMOTE"),
        row("5", "gamma", []),
      ],
      "he",
    );
    expect(remote).toBe(1);
    expect(unmapped).toBe(1);
    expect(markers.map((m) => [m.id, m.jobs.length]).sort()).toEqual([
      ["acme|hub:herzliya", 2],
      ["acme|hub:tel-aviv", 1],
      ["beta|hub:herzliya", 1],
    ]);
    const acme = markers.find((m) => m.id === "acme|hub:herzliya")!;
    expect(acme.place).toMatch(/הרצליה/);
    // jittered display point, exact routing destination
    expect(acme.lat).not.toBe(acme.dest.lat);
    expect(Math.abs(acme.lat - acme.dest.lat)).toBeLessThan(0.006);
  });
});
