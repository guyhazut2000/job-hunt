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
let browser, demoId, placeId, offerAppId, assignAppId;

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
  // Final stage (#111): undo any acceptance left by a failed run, then drop the fixtures.
  await db.application.updateMany({ where: { userId: demoId }, data: { archivedAt: null, archiveBatch: null } });
  await db.jobOffer.deleteMany({ where: { userId: demoId, label: { startsWith: "e2e-" } } });
  await db.referee.deleteMany({ where: { userId: demoId, name: { startsWith: "e2e-" } } });
  await db.application.deleteMany({ where: { userId: demoId, company: { startsWith: "e2e-" } } });
  await db.contact.deleteMany({ where: { userId: demoId, name: { startsWith: "e2e-" } } });
  await db.savedPlace.deleteMany({ where: { userId: demoId } });
  await db.rankingPrefs.deleteMany({ where: { userId: demoId } });
  await db.notification.deleteMany({ where: { userId: demoId, dedupeKey: { startsWith: "e2e-" } } });
  await db.coachReport.deleteMany({ where: { userId: demoId } });
  await db.company.deleteMany({ where: { slug: { startsWith: "e2e-" } } });
  await db.startupCandidate.deleteMany({ where: { domain: { endsWith: ".invalid" } } });

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
  offerAppId = (
    await db.application.create({
      data: { userId: demoId, title: "E2E Backend Engineer", company: "e2e-offer-co", status: "OFFER" },
    })
  ).id;
  assignAppId = (
    await db.application.create({
      data: { userId: demoId, title: "E2E Platform Engineer", company: "e2e-assign-co", status: "INTERVIEW" },
    })
  ).id;
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
  await page.getByTestId("weight-commute").waitFor(); // commute criterion (#109)
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

test("step-up ranks by the personal score with a 'why' breakdown (#109)", async () => {
  const page = await newPage();
  await login(page);
  await page.goto(`${BASE}/jobs/step-up`);
  await page.getByTestId("stepup-ranked-by").waitFor();
  if ((await page.getByTestId("stepup-gap").count()) > 0) {
    assert.ok((await page.getByTestId("personal-why").count()) > 0, "breakdown on step-up cards");
  }
  await shot(page, "step-up-personal");
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

test("weekly coach: 3 recommendations with their numbers, refresh stores the report", async () => {
  const page = await newPage();
  await login(page);
  await page.goto(`${BASE}/coach`);
  await page.getByTestId("coach-preview").waitFor();
  const recs = page.getByTestId("coach-rec");
  assert.equal(await recs.count(), 3);
  for (let i = 0; i < 3; i++) assert.ok((await recs.nth(i).getByTestId("coach-basis").innerText()).match(/\d/));
  await page.getByTestId("coach-applied").waitFor();
  await page.getByTestId("coach-refresh").click();
  await page.getByTestId("coach-preview").waitFor({ state: "detached" });
  assert.equal(await page.getByTestId("coach-rec").count(), 3);
  await shot(page, "coach-page");
  const reports = await db.coachReport.findMany({ where: { userId: demoId } });
  assert.equal(reports.length, 1);
  assert.equal(reports[0].data.recommendations.length, 3);
  // Refresh never notifies; the cron sends the WEEKLY_COACH row (unit-tested). Check it renders.
  assert.equal(await db.notification.count({ where: { userId: demoId, kind: "WEEKLY_COACH" } }), 0);
  await db.notification.create({
    data: {
      userId: demoId,
      kind: "WEEKLY_COACH",
      title: `המאמן השבועי: ${reports[0].data.activity.applied} הגשות, ${reports[0].data.activity.responses} תגובות`,
      body: "השבוע: e2e",
      url: "/coach",
      dedupeKey: "e2e-coach",
    },
  });
  await page.goto(`${BASE}/notifications`);
  await page.getByText("השבוע: e2e").waitFor();
  await shot(page, "coach-notification");
  await done(page);
});

test("jobs filters (desktop): auto-apply without reload, scroll kept, live count", async () => {
  const page = await newPage({ width: 1280, height: 900 });
  await login(page);
  await page.goto(`${BASE}/jobs?sort=personal`);
  const form = page.getByTestId("filters-d");
  await form.waitFor();
  await page.evaluate(() => {
    window.__noReload = true;
    window.scrollTo(0, 300);
  });
  const y = await page.evaluate(() => window.scrollY);
  // No apply button to reach: the submit is only an sr-only Enter fallback.
  // (the class is set on hydration, so this also waits for the form to be interactive).
  await page.waitForFunction(
    () => document.querySelector('[data-testid="filters-d"] button[type=submit]')?.classList.contains("sr-only"),
    null,
    { timeout: 15000 },
  );
  await form.locator("label.toggle-chip:has(input[name=posted][value='7d'])").click();
  await page.waitForURL(/posted=7d/);
  assert.equal(new URL(page.url()).searchParams.get("sort"), "personal", "sort kept");
  const live = page.getByTestId("filter-live-count");
  await page.waitForFunction(() => !document.querySelector("[data-testid=filter-live-count][data-pending]"));
  assert.equal(await live.getAttribute("aria-live"), "polite");
  const total = (await page.getByTestId("result-count").locator("span").first().innerText()).trim();
  assert.match(await live.innerText(), new RegExp(`^${total.replace(",", ",?")} תוצאות$`));
  // Two quick changes → one navigation with both.
  const navs = [];
  page.on("request", (r) => r.isNavigationRequest() || (r.headers()["rsc"] && navs.push(r.url())));
  const modes = form.locator("input[name=workMode]");
  await modes.nth(0).check();
  await modes.nth(1).check();
  await page.waitForURL((u) => u.searchParams.getAll("workMode").length === 2);
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-filter-pending"));
  assert.ok(navs.filter((u) => u.includes("workMode")).length <= 1, `one debounced fetch, got ${navs.length}`);
  assert.equal(await page.evaluate(() => window.__noReload), true, "no full reload");
  assert.ok(Math.abs((await page.evaluate(() => window.scrollY)) - y) < 5, "scroll position kept");
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, "desktop-auto-apply");
  await done(page);
});

test("jobs filters (mobile): floating 'הצג N משרות', chips in the sheet, clear all", async () => {
  const page = await newPage();
  await login(page);
  await page.goto(`${BASE}/jobs?sort=personal&posted=1d`);
  await page.getByRole("button", { name: /^סינון/ }).click();
  const sheet = page.getByTestId("filters-m");
  await sheet.waitFor();
  const show = page.getByTestId("sheet-show-results");
  const inView = async () => {
    const b = await show.boundingBox();
    return b && b.y >= 0 && b.y + b.height <= 844;
  };
  // Let the sheet's slide-in animation settle before measuring.
  await page
    .waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="sheet-show-results"]');
        const r = el?.getBoundingClientRect();
        return r && r.bottom <= innerHeight && r.top >= 0;
      },
      null,
      { timeout: 3000 },
    )
    .catch(() => {});
  assert.ok(await inView(), "button visible without scrolling");
  assert.match(await show.innerText(), /^הצג [\d,]+ משרות$/);
  await sheet.getByTestId("sheet-chips").waitFor();
  await shot(page, "mobile-sheet");
  await sheet.locator("input[name=workMode]").first().check();
  await page.waitForURL(/workMode=/);
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-filter-pending"));
  assert.ok(await sheet.isVisible(), "sheet stays open while applying");
  assert.equal(await sheet.getByTestId("sheet-chips").locator("li").count(), 2);
  assert.match(await show.innerText(), /^הצג [\d,]+ משרות$/);
  // Scroll to the bottom of the list: the pill is still on screen.
  await sheet.locator("select[name=tech]").scrollIntoViewIfNeeded();
  assert.ok(await inView(), "button stays visible after scrolling the sheet");
  await shot(page, "mobile-sheet-applied");
  // One-tap chip removal.
  await sheet.getByTestId("sheet-chips").locator("a").first().click();
  await page.waitForURL((u) => !u.searchParams.has("posted"));
  assert.ok(new URL(page.url()).searchParams.has("workMode"));
  assert.equal(await sheet.locator("input[name=posted][value='1d']").isChecked(), false, "form reset to the URL");
  await page.getByTestId("sheet-clear").click();
  await page.waitForURL((u) => !u.searchParams.has("workMode"));
  await show.click();
  await sheet.waitFor({ state: "hidden" });
  const total = (await page.getByTestId("result-count").locator("span").first().innerText()).trim();
  assert.ok(Number(total.replace(/,/g, "")) > 0);
  await shot(page, "mobile-results");
  await done(page);
});

// Data density (docs/ui-data-density.md): with a few hundred rows the long lists must stay capped,
// "הצג עוד" / "טען עוד" must reveal more, and nothing may scroll sideways at 390px.
test("data density: capped lists, show more / load more, no horizontal overflow at 390", async () => {
  const BULK = "e2e-bulk-";
  const cleanup = () =>
    Promise.all([
      db.application.deleteMany({ where: { userId: demoId, company: { startsWith: BULK } } }),
      db.contact.deleteMany({ where: { userId: demoId, name: { startsWith: BULK } } }),
      db.notification.deleteMany({ where: { userId: demoId, dedupeKey: { startsWith: BULK } } }),
    ]);
  await cleanup();
  const pad = (i) => String(i).padStart(2, "0");
  await db.application.createMany({
    data: Array.from({ length: 45 }, (_, i) => ({
      userId: demoId,
      title: `Bulk role ${pad(i)}`,
      company: `${BULK}${pad(i)}`,
      status: "SAVED",
    })),
  });
  await db.contact.createMany({
    data: Array.from({ length: 30 }, (_, i) => ({
      userId: demoId,
      name: `${BULK}${pad(i)}`,
      category: "PEER",
      status: "NOT_CONTACTED",
    })),
  });
  await db.notification.createMany({
    data: Array.from({ length: 45 }, (_, i) => ({
      userId: demoId,
      kind: "SYSTEM",
      title: `e2e bulk notification ${pad(i)}`,
      dedupeKey: `${BULK}${pad(i)}`,
    })),
  });
  const page = await newPage();
  try {
    await login(page);
    const overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const height = () => page.evaluate(() => document.documentElement.scrollHeight);

    // Kanban: a column shows 20 cards, then "הצג עוד"; the filter finds a hidden card.
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    const saved = page.locator('section[data-col="SAVED"]');
    const cards = saved.getByTestId("kanban-remove");
    assert.equal(await cards.count(), 20, "SAVED column starts at 20 cards");
    await page.getByTestId("kanban-more-SAVED").click();
    assert.ok((await cards.count()) > 20, "show more reveals more cards");
    await page.getByTestId("kanban-filter").fill(`${BULK}44`);
    assert.equal(await cards.count(), 1, "the filter finds a card that was hidden");
    assert.ok((await overflow()) <= 1, "dashboard: no horizontal overflow");
    await shot(page, "density-dashboard");

    // Outreach tracker: 20 rows, then "הצג עוד"; select-all covers only the visible rows.
    await page.goto(`${BASE}/outreach`, { waitUntil: "networkidle" });
    const rows = page.getByTestId("tracker-row");
    assert.equal(await rows.count(), 20, "tracker starts at 20 rows");
    await page.getByTestId("tracker-more").locator("button").first().click();
    assert.ok((await rows.count()) > 20);
    await page.getByTestId("tracker-filter").fill(`${BULK}29`);
    assert.equal(await rows.count(), 1);
    assert.ok((await overflow()) <= 1, "outreach: no horizontal overflow");

    // Notifications: 30 per page from the server, "טען עוד" keeps the URL state.
    await page.goto(`${BASE}/notifications`, { waitUntil: "networkidle" });
    const items = page.getByTestId("notification-list").locator("li");
    assert.equal(await items.count(), 30);
    await page.getByTestId("notifications-paging-next").click();
    await page.waitForURL(/show=60/);
    assert.ok((await items.count()) > 30);
    assert.ok((await height()) < 20_000, "notifications stay a bounded height");
    assert.ok((await overflow()) <= 1, "notifications: no horizontal overflow");

    for (const path of ["/referrals", "/salary", "/salary/offers", "/settings/notifications", "/features"]) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      assert.ok((await overflow()) <= 1, `${path}: no horizontal overflow at 390`);
      const nodes = await page.evaluate(() => document.getElementsByTagName("*").length);
      assert.ok(nodes < 5000, `${path}: DOM stays small (${nodes} nodes)`);
    }
    await done(page);
  } finally {
    await cleanup();
  }
});

// ───────────────────────── final stage (#111) ─────────────────────────

/** "YYYY-MM-DDTHH:mm" in Israel time, for datetime-local inputs. */
const israelLocal = (d) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(d)
    .replace(" ", "T");

const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test("final stage: home assignment saved from the tracker card link, shows its due badge", async () => {
  const page = await newPage({ width: 1366, height: 900 });
  await login(page);
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  const link = page.locator(`[data-testid=kanban-assignments][href="/closing/assignments?app=${assignAppId}"]`);
  assert.equal(await link.count(), 1, "tracker card links to the assignment form");
  await page.goto(`${BASE}/closing/assignments?app=${assignAppId}`, { waitUntil: "networkidle" });
  assert.equal(await page.getByTestId("assignment-app").inputValue(), assignAppId);
  await page.getByTestId("assignment-title").fill("e2e-מטלת בית: API קטן");
  await page.getByTestId("assignment-due-input").fill(israelLocal(new Date(Date.now() + 10 * 3_600_000)));
  await page.getByTestId("assignment-save").click();
  const row = page.getByTestId("assignment-row").filter({ hasText: "e2e-מטלת בית" });
  await row.waitFor();
  assert.ok((await row.getByTestId("assignment-due").innerText()).trim().length > 0);
  await shot(page, "final-assignments-desktop");
  await done(page);
});

test("final stage: referee linked to an application, brief reminder clears once marked briefed", async () => {
  const page = await newPage({ width: 1366, height: 900 });
  await login(page);
  await page.goto(`${BASE}/closing/references`, { waitUntil: "networkidle" });
  await page.getByTestId("referee-name").fill("e2e-רונית כהן");
  await page.getByTestId("referee-save").click();
  const row = page.getByTestId("referee-row").filter({ hasText: "e2e-רונית כהן" });
  await row.waitFor();
  assert.equal(await row.getByTestId("draft-request").count(), 1, "not asked yet: a request draft to copy");
  const form = row.getByTestId("referee-link-form");
  await form.locator("select[name=applicationId]").selectOption(assignAppId);
  await form.locator("input[name=expectedCallAt]").fill(israelLocal(new Date(Date.now() + 20 * 3_600_000)));
  await form.locator("button[type=submit]").click();
  await row.getByTestId("referee-link").waitFor();
  await row.getByTestId("referee-needs-brief").waitFor();
  assert.ok(await row.getByTestId("draft-brief").count(), "brief draft to copy");
  await shot(page, "final-references-desktop");
  await row.getByTestId("referee-mark-briefedAt").click();
  await row.getByTestId("referee-needs-brief").waitFor({ state: "detached" });
  await done(page);
});

test("final stage: contract checklist, notice calculator, accept archives the others and undo restores", async () => {
  const page = await newPage({ width: 1366, height: 900 });
  await login(page);
  await page.goto(`${BASE}/closing`, { waitUntil: "networkidle" });
  const start = page.locator("li").filter({ hasText: "e2e-offer-co" }).getByTestId("closing-start");
  await Promise.all([page.waitForURL(/\/closing\/c[a-z0-9]+/), start.click()]);
  await page.getByTestId("contract-checklist").waitFor();
  await page.getByTestId("closing-disclaimer").first().waitFor();
  // A legal minimum with an official source.
  assert.match(await page.getByTestId("clause-pension-minimum").innerText(), /\d/);
  await page.getByTestId("clause-pension-concern").click();
  await page.waitForFunction(
    () => document.querySelector("[data-testid=clause-pension]")?.getAttribute("data-status") === "concern",
  );
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.getByTestId("clause-pension").getAttribute("data-status"), "concern", "saved");
  assert.ok((await page.getByTestId("contract-question").count()) >= 1);

  await page.getByTestId("notice-start").fill("2024-01-01");
  await page.getByTestId("notice-date").fill("2026-11-08");
  await page.getByTestId("notice-new-start").fill("2026-12-15");
  await page.getByTestId("notice-calc").click();
  await page.getByTestId("notice-last-day").waitFor();
  await page.getByTestId("draft-resignation").waitFor({ state: "attached" });
  await shot(page, "final-offer-desktop");

  const archivedBefore = await db.application.count({ where: { userId: demoId, archivedAt: { not: null } } });
  assert.equal(archivedBefore, 0);
  const list = page.getByTestId("accept-archive-list");
  assert.match(await list.innerText(), /e2e-assign-co/);
  await page.getByTestId("accept-confirm").check();
  await page.getByTestId("accept-submit").click();
  await page.getByTestId("accept-done").waitFor();
  assert.ok(await page.getByTestId("draft-withdraw").count(), "withdrawal drafts to copy");
  const archived = await db.application.findMany({ where: { userId: demoId, archivedAt: { not: null } } });
  assert.ok(archived.some((a) => a.id === assignAppId));
  assert.ok(!archived.some((a) => a.id === offerAppId), "the accepted application stays");
  assert.ok(archived.every((a) => a.status !== "REJECTED"));
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  assert.equal(await page.getByText("e2e-assign-co").count(), 0, "archived apps leave the tracker");
  await page.goBack({ waitUntil: "networkidle" });
  await page.getByTestId("accept-undo").click();
  await page.getByTestId("accept-form").waitFor();
  assert.equal(await db.application.count({ where: { userId: demoId, archivedAt: { not: null } } }), 0);
  await done(page);
});

test("final stage pages fit a 390px screen (no horizontal scroll)", async () => {
  const page = await newPage();
  await login(page);
  const offer = await db.jobOffer.findFirst({ where: { userId: demoId, applicationId: offerAppId } });
  const pages = [
    ["/closing", "final-hub"],
    ["/closing/assignments", "final-assignments"],
    ["/closing/references", "final-references"],
    ...(offer ? [[`/closing/${offer.id}`, "final-offer"]] : []),
  ];
  for (const [path, name] of pages) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    assert.ok(await noHScroll(page), `${path}: no horizontal scroll at 390px`);
    await shot(page, `${name}-mobile`);
  }
  await done(page);
});

test("suggest a company: clear thank-you, then 'ההצעות שלי' shows its status (#120)", async () => {
  // A .invalid domain never resolves, so the instant check finishes offline: no careers page → admin review.
  for (const [vp, tag] of [
    [{ width: 1280, height: 900 }, "desktop"],
    [{ width: 390, height: 844 }, "mobile"],
  ]) {
    const page = await newPage(vp);
    await login(page);
    await page.goto(`${BASE}/companies#suggest`);
    await page.fill("#suggest-name", `E2E Suggest ${tag}`);
    await page.fill("#suggest-url", `https://e2e-suggest-${tag}.invalid`);
    await page.click("[data-testid=suggest-company] button[type=submit]");
    await page.getByText("אנחנו בודקים עכשיו את אתר החברה").waitFor({ timeout: 30_000 });
    const item = page.locator("[data-testid=my-suggestion]", { hasText: `E2E Suggest ${tag}` });
    await item.waitFor({ timeout: 30_000 });
    // "checking" auto-refreshes into the result of the instant check.
    await page.waitForFunction(
      (name) =>
        [...document.querySelectorAll("[data-testid=my-suggestion]")].some(
          (li) => li.textContent.includes(name) && li.getAttribute("data-status") === "review",
        ),
      `E2E Suggest ${tag}`,
      { timeout: 90_000 },
    );
    assert.match(await item.textContent(), /ממתינה לאישור מנהל/);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      0,
    );
    await item.scrollIntoViewIfNeeded();
    await shot(page, `suggest-company-${tag}`);
    await done(page);
  }
});
