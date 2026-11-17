import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  created: [] as Record<string, unknown>[],
  deleteWhere: null as unknown,
  session: null as null | { user: { id: string; email: string; role: "USER" | "ADMIN" } },
  failInsert: false,
}));

vi.mock("@/lib/db", () => ({
  db: {
    activityEvent: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (store.failInsert) throw new Error('relation "ActivityEvent" does not exist');
        store.created.push(data);
        return data;
      }),
      deleteMany: vi.fn(async ({ where }: { where: unknown }) => {
        store.deleteWhere = where;
        return { count: 3 };
      }),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
  },
}));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => store.session) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

import { canViewActivity, activityViewers, requireActivityViewer } from "@/lib/activity/access";
import { cleanPath, geoFromHeaders, hashIp, isBot, parseUserAgent } from "@/lib/activity/context";
import { activityWhere, israelDayStart, parseActivityFilters } from "@/lib/activity/query";
import { buildActivityRow, purgeOldActivity, recordActivity } from "@/lib/activity/record";
import { GET, POST } from "@/app/api/activity/route";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

const OWNER = { id: "u1", email: "guyhazut2000@gmail.com", role: "ADMIN" as const };
const OTHER_ADMIN = { id: "u2", email: "admin@job-hunt.local", role: "ADMIN" as const };
const USER = { id: "u3", email: "demo@job-hunt.local", role: "USER" as const };

beforeEach(() => {
  store.created = [];
  store.deleteWhere = null;
  store.session = null;
  store.failInsert = false;
});

describe("activity access (owner only)", () => {
  it("defaults to guyhazut2000@gmail.com, case-insensitively", () => {
    expect(activityViewers({})).toEqual(["guyhazut2000@gmail.com"]);
    expect(canViewActivity({ email: "GuyHazut2000@Gmail.com" }, {})).toBe(true);
  });

  it("denies other admins, regular users and guests", () => {
    expect(canViewActivity(OTHER_ADMIN, {})).toBe(false);
    expect(canViewActivity(USER, {})).toBe(false);
    expect(canViewActivity(null, {})).toBe(false);
    expect(canViewActivity({ email: "" }, {})).toBe(false);
  });

  it("ACTIVITY_LOG_VIEWERS overrides the allowlist", () => {
    const env = { ACTIVITY_LOG_VIEWERS: " a@x.com , B@y.com " };
    expect(activityViewers(env)).toEqual(["a@x.com", "b@y.com"]);
    expect(canViewActivity({ email: "b@y.com" }, env)).toBe(true);
    expect(canViewActivity(OWNER, env)).toBe(false);
  });

  it("page guard: guest → login, non-owner admin → 404, owner passes", async () => {
    await expect(requireActivityViewer()).rejects.toThrow(/NEXT_REDIRECT \/login/);
    store.session = { user: OTHER_ADMIN };
    await expect(requireActivityViewer()).rejects.toThrow("NEXT_NOT_FOUND");
    store.session = { user: USER };
    await expect(requireActivityViewer()).rejects.toThrow("NEXT_NOT_FOUND");
    store.session = { user: OWNER };
    await expect(requireActivityViewer()).resolves.toMatchObject({ email: OWNER.email });
  });

  it("GET /api/activity is 403 for everyone but the owner", async () => {
    const req = () => new Request("http://x/api/activity");
    expect((await GET(req())).status).toBe(403);
    store.session = { user: OTHER_ADMIN };
    expect((await GET(req())).status).toBe(403);
    store.session = { user: OWNER };
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ rows: [], total: 0 });
  });
});

describe("request context", () => {
  it("parses coarse device, OS and browser", () => {
    expect(parseUserAgent(IPHONE)).toEqual({ device: "mobile", os: "iOS", browser: "Safari" });
    expect(parseUserAgent(MAC_CHROME)).toEqual({ device: "desktop", os: "macOS", browser: "Chrome" });
  });

  it("flags bots and empty user agents", () => {
    expect(isBot("Googlebot/2.1 (+http://www.google.com/bot.html)")).toBe(true);
    expect(isBot("curl/8.0")).toBe(true);
    expect(isBot(null)).toBe(true);
    expect(isBot(IPHONE)).toBe(false);
  });

  it("reads Vercel geo headers (URL-encoded city)", () => {
    const h = new Headers({
      "x-vercel-ip-country": "IL",
      "x-vercel-ip-city": "Tel%20Aviv",
      "x-vercel-ip-country-region": "TA",
    });
    expect(geoFromHeaders(h)).toEqual({ country: "IL", region: "TA", city: "Tel Aviv" });
    expect(geoFromHeaders(new Headers())).toEqual({});
  });

  it("hashes the IP with a secret and never returns it raw", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    const a = hashIp(h, "s1")!;
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(a).not.toContain("203");
    expect(hashIp(h, "s1")).toBe(a);
    expect(hashIp(h, "s2")).not.toBe(a);
    expect(hashIp(new Headers(), "s1")).toBeUndefined();
  });

  it("accepts only clean app pathnames", () => {
    expect(cleanPath("/jobs")).toBe("/jobs");
    expect(cleanPath("/jobs/abc?q=secret#x")).toBe("/jobs/abc");
    for (const bad of ["jobs", "//evil.com", "/_next/static/x", "/api/events", "/logo.png", "/a b", 5, null]) {
      expect(cleanPath(bad), String(bad)).toBeNull();
    }
    expect(cleanPath(`/${"a".repeat(250)}`)).toBeNull();
  });
});

describe("recording", () => {
  it("builds a row with geo, device and hashed IP but no raw IP", () => {
    const h = new Headers({
      "user-agent": IPHONE,
      "x-forwarded-for": "203.0.113.7",
      "x-vercel-ip-country": "IL",
      "x-vercel-ip-city": "Haifa",
    });
    const row = buildActivityRow({ type: "sign_in", userId: "u1", email: " Guy@X.com " }, h)!;
    expect(row).toMatchObject({
      type: "sign_in",
      userId: "u1",
      email: "guy@x.com",
      country: "IL",
      city: "Haifa",
      device: "mobile",
    });
    expect(row.ipHash).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.stringify(row)).not.toContain("203.0.113.7");
  });

  it("drops bot page views", () => {
    const h = new Headers({ "user-agent": "Googlebot/2.1" });
    expect(buildActivityRow({ type: "page_view", userId: "u1", path: "/jobs" }, h)).toBeNull();
  });

  it("stores events and never throws when the insert fails", async () => {
    await recordActivity({ type: "sign_up", userId: "u9", email: "n@x.com" }, null);
    expect(store.created).toHaveLength(1);
    expect(store.created[0]).toMatchObject({ type: "sign_up", userId: "u9" });
    store.failInsert = true;
    await expect(recordActivity({ type: "sign_in", userId: "u9" }, null)).resolves.toBeUndefined();
  });

  it("beacon records a signed-in page view and ignores guests, bad paths and the log itself", async () => {
    const beacon = (body: string) => new Request("http://x/api/activity", { method: "POST", body });
    expect((await POST(beacon('{"path":"/jobs"}'))).status).toBe(204);
    expect(store.created).toHaveLength(0); // guest
    store.session = { user: USER };
    await POST(beacon('{"path":"/jobs?q=x"}'));
    await POST(beacon('{"path":"/_next/static/chunk.js"}'));
    await POST(beacon('{"path":"/admin/activity"}'));
    await POST(beacon("not json"));
    expect(store.created).toEqual([
      expect.objectContaining({ type: "page_view", userId: "u3", email: "demo@job-hunt.local", path: "/jobs" }),
    ]);
  });

  it("purges rows older than the retention window", async () => {
    const now = new Date("2026-11-17T10:00:00Z");
    expect(await purgeOldActivity(now, 90)).toEqual({ deleted: 3 });
    expect(store.deleteWhere).toEqual({ createdAt: { lt: new Date("2026-08-19T10:00:00Z") } });
  });
});

describe("filters", () => {
  it("parses and sanitises query params", () => {
    expect(parseActivityFilters({ type: "sign_in", user: " demo ", from: "2026-11-01", to: "bad", page: "3" })).toEqual(
      {
        type: "sign_in",
        user: "demo",
        from: "2026-11-01",
        page: 3,
      },
    );
    expect(parseActivityFilters({ type: "DROP TABLE", page: "-4" })).toEqual({ page: 1 });
  });

  it("uses Israel-time day boundaries", () => {
    // Israel is UTC+2 in November and UTC+3 in July.
    expect(israelDayStart("2026-11-17").toISOString()).toBe("2026-11-16T22:00:00.000Z");
    expect(israelDayStart("2026-07-01").toISOString()).toBe("2026-06-30T21:00:00.000Z");
    const where = activityWhere({ from: "2026-11-17", to: "2026-11-17", page: 1 });
    expect(where.createdAt).toEqual({
      gte: new Date("2026-11-16T22:00:00.000Z"),
      lt: new Date("2026-11-17T22:00:00.000Z"),
    });
  });
});
