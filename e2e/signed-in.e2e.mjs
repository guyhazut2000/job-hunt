// Signed-in end-to-end smoke for the flows that keep regressing (#95).
// Runs against a built `next start` (BASE_URL, default http://localhost:3000) and the seeded DB
// (demo@job-hunt.local / password123). Fixture rows are tagged "e2e-" and recreated each run.
// No AI key is needed: exports fall back to the untranslated path and report it in a header.
//   node --test e2e/          (CHROME_PATH=/usr/bin/google-chrome by default)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright-core";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.E2E_SHOTS; // optional screenshot dir
const DEMO = { email: "demo@job-hunt.local", password: "password123" };
const DAY = 86_400_000;
const db = new PrismaClient();

// A CV that meets the mandatory one-page standard (#94): summary, X-Y-Z bullets with numbers.
const PASSING_CV = {
  headline: "מפתחת Backend",
  summary:
    "מפתחת Backend עם 4 שנות ניסיון ב-Node.js ו-PostgreSQL במערכות תשלומים בהיקף גבוה. בניתי שירותים שמעבדים מיליוני טרנזקציות בחודש ושיפרתי זמני תגובה ויציבות. מחפשת תפקיד Backend בחברת מוצר עם אתגרי סקייל אמיתיים.",
  phone: "050-1234567",
  location: "תל אביב",
  linkedinUrl: "https://www.linkedin.com/in/e2e-demo",
  skillItems: ["Node.js", "PostgreSQL", "AWS", "Docker", "TypeScript"].map((name) => ({
    name,
    level: "GOOD",
    category: "other",
  })),
  experience: [
    {
      company: "Acme Payments",
      title: "Backend Developer",
      start: "2022-03",
      end: "",
      tech: [],
      description:
        "פיתחתי ממשק תשלומים ב-Node.js שמעבד 2M טרנזקציות בחודש, וקיצרתי את זמן התגובה ב-35%\nהובלתי מעבר של מסד הנתונים ל-PostgreSQL 15 בלי השבתה, וחסכתי 20% בעלויות האחסון\nבניתי שירות התראות על AWS Lambda שמגיע ל-50K משתמשים ביום בזמינות של 99.9%",
    },
    {
      company: "Startup X",
      title: "Junior Developer",
      start: "2020-06",
      end: "2022-02",
      tech: [],
      description: "פיתחתי 12 מסכים באפליקציית ניהול לקוחות ב-React, שקיצרו את זמן הטיפול בפנייה ב-25%",
    },
  ],
  education: [
    { kind: "DEGREE", institution: "אוניברסיטת תל אביב", title: "B.Sc. מדעי המחשב", start: "2016-10", end: "2020-06" },
    { kind: "MILITARY", institution: "צה״ל", title: "תכניתנית, ממר״ם", start: "2014-08", end: "2016-08" },
  ],
  languages: [
    { name: "עברית", level: "NATIVE" },
    { name: "English", level: "FLUENT" },
  ],
};
let browser, demoId, placeId;

async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}

/** A Hebrew-locale page that fails the test on uncaught errors or 5xx responses. */
async function newPage(viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  await ctx.addCookies([{ name: "jh_locale", value: "he", url: BASE }]);
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e).slice(0, 300)));
  page.on("response", (r) => r.status() >= 500 && page.errors.push(`${r.status()} ${r.url()}`));
  return page;
}

async function login(page, { email, password } = DEMO) {
  await page.goto(`${BASE}/login`);
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 }),
    page.click("form[aria-busy] button[type=submit]"),
  ]);
}

const done = async (page) => {
  assert.deepEqual(page.errors, [], "no page errors / 5xx");
  await page.context().close();
};

before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
    args: ["--no-sandbox"],
  });
  const demo = await db.user.findUniqueOrThrow({ where: { email: DEMO.email } });
  demoId = demo.id;
  // Clean previous fixtures (by tag), then recreate.
  await db.application.deleteMany({ where: { userId: demoId, company: { startsWith: "e2e-" } } });
  await db.contact.deleteMany({ where: { userId: demoId, name: { startsWith: "e2e-" } } });
  await db.savedPlace.deleteMany({ where: { userId: demoId } });
  await db.rankingPrefs.deleteMany({ where: { userId: demoId } });
  await db.notification.deleteMany({ where: { userId: demoId, dedupeKey: { startsWith: "e2e-" } } });
  await db.company.deleteMany({ where: { slug: { startsWith: "e2e-" } } });

  // 60 manual companies → two pages under a filter (48 per page).
  await db.company.createMany({
    data: Array.from({ length: 60 }, (_, i) => ({
      slug: `e2e-load-${String(i).padStart(2, "0")}`,
      name: `E2E Load Co ${String(i).padStart(2, "0")}`,
      syncMode: "MANUAL",
      atsProvider: "MANUAL",
    })),
  });
  const co = await db.company.findUniqueOrThrow({ where: { slug: "e2e-load-00" } });
  const job = (externalId, title, techStack) => ({
    companyId: co.id,
    externalId,
    source: "MANUAL",
    title,
    roleCategory: "fullstack",
    seniority: "MID",
    location: "Tel Aviv",
    workMode: "HYBRID",
    techStack,
    description: `${title}. ${techStack.join(", ")}`,
    applyUrl: `https://example.com/${externalId}`,
    postedAt: new Date(Date.now() - DAY),
  });
  await db.job.createMany({
    data: [
      job("e2e-ts", "Full Stack Engineer (TypeScript, React)", ["TypeScript", "React", "Node.js"]),
      job("e2e-php", "Full Stack Engineer (PHP, Laravel)", ["PHP", "Laravel"]),
    ],
  });

  await db.application.createMany({
    data: [1, 2].map((n) => ({ userId: demoId, title: `E2E role ${n}`, company: `e2e-co-${n}`, status: "SAVED" })),
  });
  await db.contact.createMany({
    data: [
      {
        userId: demoId,
        name: "e2e-אורי",
        category: "TEAM_LEAD",
        status: "SENT",
        sentAt: new Date(Date.now() - 4 * DAY),
        statusAt: new Date(Date.now() - 4 * DAY),
      },
      { userId: demoId, name: "e2e-נועה", category: "RECRUITER", status: "NOT_CONTACTED" },
      { userId: demoId, name: "e2e-דנה", category: "PEER", status: "NOT_CONTACTED" },
    ],
  });
  const place = await db.savedPlace.create({
    data: {
      userId: demoId,
      label: "e2e-בית",
      address: "Dizengoff 50, Tel Aviv",
      lat: 32.0775,
      lng: 34.7744,
      isDefault: true,
    },
  });
  placeId = place.id;
});

after(async () => {
  await browser?.close();
  await db.$disconnect();
});

test("onboarding wizard (manual path): finishing with an empty CV is gated by the CV standard, no restart", async () => {
  const page = await newPage();
  const email = `e2e-onb-${Date.now()}@job-hunt.local`;
  await page.goto(`${BASE}/register`);
  await page.fill("input[name=name]", "בודק אונבורדינג");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", "password123");
  await Promise.all([
    page.waitForURL(/\/onboarding/, { timeout: 60_000 }),
    page.click("form[aria-busy] button[type=submit]"),
  ]);
  await Promise.all([page.waitForURL(/step=2/), page.click("[data-testid=onb-manual]")]);
  await shot(page, "onboarding-step2");
  await Promise.all([page.waitForURL(/step=3/), page.click("button:has-text('אישור ושמירה')")]);
  await Promise.all([page.waitForURL(/step=4/), page.locator("main form button[type=submit]").last().click()]);
  await page.locator("[data-testid=onb-templates]").waitFor();
  // A manual profile has no CV yet, so finishing is blocked by the mandatory CV standard (#94).
  await Promise.all([
    page.waitForURL((u) => u.pathname === "/cv/standard" && u.searchParams.get("from") === "onboarding"),
    page.click("[data-testid=onb-finish]"),
  ]);
  await shot(page, "onboarding-cv-standard-gate");
  await page.goto(`${BASE}/jobs`);
  assert.equal(new URL(page.url()).pathname, "/jobs", "no second onboarding redirect");
  await page.getByTestId("cv-standard-banner").waitFor();
  await done(page);
  await db.user.delete({ where: { email } });
});

test("CV export: blocked until the CV standard passes, then he/en × pdf/docx, signed-out is 401", async () => {
  const page = await newPage({ width: 1280, height: 900 });
  const anon = await page.context().request.get(`${BASE}/api/cv/export?template=hitech&lang=he&format=pdf`);
  assert.equal(anon.status(), 401);
  await login(page);
  const req = page.context().request;
  // Skills-only seed profile fails the mandatory standard → export redirects to the guided editor.
  await db.profile.update({ where: { userId: demoId }, data: { summary: "", experience: [], education: [] } });
  const gated = await req.get(`${BASE}/api/cv/export?template=hitech&lang=he&format=pdf`, { maxRedirects: 0 });
  assert.equal(gated.status(), 303);
  assert.match(gated.headers().location ?? "", /\/cv\/standard\?from=export/);
  await db.profile.update({ where: { userId: demoId }, data: PASSING_CV });
  for (const lang of ["he", "en"]) {
    for (const format of ["pdf", "docx"]) {
      const r = await req.get(`${BASE}/api/cv/export?template=hitech&lang=${lang}&format=${format}`);
      assert.equal(r.status(), 200, `${lang}/${format}`);
      const body = await r.body();
      assert.ok(body.length > 1000, `${lang}/${format} non-trivial file`);
      const magic = body.subarray(0, 4).toString("latin1");
      assert.equal(magic, format === "pdf" ? "%PDF" : "PK\u0003\u0004", `${lang}/${format} magic`);
      assert.match(r.headers()["content-disposition"] ?? "", /attachment/);
      if (lang === "en") assert.ok(r.headers()["x-cv-translation"], "en export reports translation outcome");
    }
  }
  await page.goto(`${BASE}/cv/templates/hitech`);
  const dl = page.waitForEvent("download", { timeout: 60_000 });
  await page.click("[data-testid=cv-export-pdf]");
  const file = await dl;
  assert.match(file.suggestedFilename(), /\.pdf$/);
  const status = page.getByTestId("cv-export-status");
  await status.waitFor({ timeout: 30_000 });
  assert.ok(["done", "translateLimited", "translateFailed"].includes(await status.getAttribute("data-outcome")));
  await shot(page, "cv-export-editor");
  await done(page);
});

test("dashboard delete shows undo and undo restores the card", async () => {
  const page = await newPage({ width: 1366, height: 900 });
  await login(page);
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  const cards = page.getByTestId("kanban-remove");
  const n0 = await cards.count();
  assert.ok(n0 >= 2);
  await cards.first().click();
  await page.getByTestId("undo-delete-toast").waitFor();
  assert.equal(await cards.count(), n0 - 1);
  await shot(page, "dashboard-undo-toast");
  await page.getByTestId("undo-delete").click();
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await cards.count(), n0, "card survives a reload after undo");
  await done(page);
});

test("companies 'טען עוד' keeps the search and sync filter", async () => {
  const page = await newPage();
  await login(page);
  await page.goto(`${BASE}/companies?sync=manual&q=${encodeURIComponent("E2E Load")}`);
  const cards = page.locator("[data-sync]");
  assert.equal(await cards.count(), 48);
  const more = page.getByTestId("companies-load-more");
  await more.scrollIntoViewIfNeeded();
  await Promise.all([page.waitForURL(/show=96/), more.click()]);
  const u = new URL(page.url());
  assert.equal(u.searchParams.get("sync"), "manual");
  assert.equal(u.searchParams.get("q"), "E2E Load");
  await page.locator("[data-sync]").nth(59).waitFor();
  assert.equal(await page.locator("[data-sync]").count(), 60);
  assert.equal(await page.getByTestId("companies-load-more").count(), 0, "no more pages");
  await shot(page, "companies-load-more");
  await done(page);
});

test("keyword ranking: include/exclude keywords reorder 'התאמה אישית'", async () => {
  const page = await newPage();
  await login(page);
  await page.goto(`${BASE}/jobs/ranking`);
  await page.fill("[data-testid=inc-input]", "TypeScript");
  await page.click("[data-testid=inc-add]");
  await page.fill("[data-testid=exc-input]", "PHP");
  await page.keyboard.press("Enter");
  await page.click("[data-testid=ranking-save]");
  await page.locator("[data-testid=ranking-status]", { hasText: "נשמר" }).waitFor({ timeout: 30_000 });
  await page.goto(`${BASE}/jobs?sort=personal&q=${encodeURIComponent("Full Stack Engineer (")}`);
  const text = await page.locator("main").innerText();
  const ts = text.indexOf("(TypeScript, React)");
  const php = text.indexOf("(PHP, Laravel)");
  assert.ok(ts >= 0, "TypeScript job listed");
  assert.ok(php === -1 || ts < php, "excluded keyword ranks lower");
  assert.ok((await page.getByTestId("personal-score").count()) > 0);
  await shot(page, "ranking-jobs");
  await done(page);
});

test("map view uses the default saved place as the commute origin", async () => {
  const page = await newPage({ width: 1280, height: 900 });
  await login(page);
  await page.goto(`${BASE}/jobs?view=map`);
  const origin = page.getByTestId("origin-select");
  await origin.waitFor();
  assert.equal(await origin.inputValue(), placeId);
  await page.goto(`${BASE}/jobs?origin=${placeId}`);
  assert.equal(await page.getByTestId("origin-select").inputValue(), placeId, "explicit saved place in list view");
  await shot(page, "map-saved-place");
  await done(page);
});

test("outreach tracker: 'התקבלה?' check, one-tap status, bulk update", async () => {
  const page = await newPage();
  await login(page);
  await page.goto(`${BASE}/outreach`);
  const row = (name) => page.getByTestId("tracker-row").filter({ hasText: name });
  await row("e2e-אורי").getByTestId("tracker-check").waitFor();
  await row("e2e-אורי").getByTestId("tracker-quick-ACCEPTED").click();
  await row("e2e-אורי").getByTestId("tracker-check").waitFor({ state: "detached" });
  for (const n of ["e2e-נועה", "e2e-דנה"]) await row(n).getByTestId("tracker-select").check();
  await page.getByTestId("tracker-bulk-status").selectOption("SENT");
  await page.getByTestId("tracker-bulk-apply").click();
  await shot(page, "outreach-bulk");
  await page.waitForTimeout(800);
  const rows = await db.contact.findMany({ where: { userId: demoId, name: { startsWith: "e2e-" } } });
  const by = Object.fromEntries(rows.map((c) => [c.name, c.status]));
  assert.equal(by["e2e-אורי"], "ACCEPTED");
  assert.equal(by["e2e-נועה"], "SENT");
  assert.equal(by["e2e-דנה"], "SENT");
  await done(page);
});

test("high-match alert: settings save threshold/cap, alert shows in the notifications page", async () => {
  const page = await newPage();
  await login(page);
  await page.goto(`${BASE}/settings/notifications`);
  const box = page.getByTestId("high-match-prefs");
  await box.waitFor();
  await page.getByTestId("high-match-threshold").selectOption("85");
  await page.getByTestId("high-match-cap").fill("5");
  await page.getByTestId("prefs-save").click();
  await page.getByText("נשמר", { exact: true }).waitFor();
  await box.scrollIntoViewIfNeeded();
  await shot(page, "high-match-settings");
  const prefs = await db.notificationPreference.findUnique({ where: { userId: demoId } });
  assert.equal(prefs.highMatchEnabled, true);
  assert.equal(prefs.highMatchThreshold, 85);
  assert.equal(prefs.highMatchDailyCap, 5);
  // The runner itself is unit-tested; here we check a HIGH_MATCH row renders for the user.
  await db.notification.create({
    data: {
      userId: demoId,
      kind: "HIGH_MATCH",
      title: "91% התאמה אישית: e2e Full Stack Engineer",
      body: "E2E Load Co 00 · Tel Aviv. למה: התאמת פרופיל 91",
      url: "/jobs?sort=personal",
      dedupeKey: "e2e-highmatch",
    },
  });
  await page.goto(`${BASE}/notifications`);
  await page.getByText("91% התאמה אישית: e2e Full Stack Engineer").waitFor();
  await shot(page, "high-match-notification");
  await db.notificationPreference.update({
    where: { userId: demoId },
    data: { highMatchThreshold: 80, highMatchDailyCap: 3 },
  });
  await done(page);
});
