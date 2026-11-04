// Local-only stress fixtures for UI data-density checks (docs/ui-data-density.md).
// Adds thousands of jobs and hundreds of companies/applications/contacts/notifications for the demo
// user, all tagged "stress-" so they are easy to spot and remove. Refuses to run against any
// non-local database: these rows are synthetic test data and must never reach production.
//   DATABASE_URL=postgresql://…@localhost:5432/jobhunt_stress npx tsx scripts/seed-stress.ts [--clean]
import { PrismaClient, type ApplicationStatus, type ContactCategory, type ContactStatus } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
  console.error("seed-stress: DATABASE_URL must point at localhost. Refusing.");
  process.exit(1);
}
const db = new PrismaClient();
const N = {
  companies: 400,
  jobs: 3000,
  apps: 400,
  contacts: 300,
  referrals: 120,
  notifications: 400,
  searches: 60,
  salary: 150,
};
const DAY = 86_400_000;
const pick = <T>(a: readonly T[], i: number) => a[i % a.length];
const TECH = [
  "TypeScript",
  "React",
  "Node.js",
  "Python",
  "Go",
  "Kubernetes",
  "AWS",
  "GCP",
  "PostgreSQL",
  "Redis",
  "Kafka",
  "Terraform",
  "Java",
  "Spring",
  "C++",
  "Rust",
  "GraphQL",
  "Docker",
  "Next.js",
  "Vue",
  "Angular",
  "Spark",
  "Airflow",
  "Snowflake",
  "dbt",
  "PyTorch",
  "TensorFlow",
  "Linux",
  "CI/CD",
  "Elasticsearch",
];
const CITIES = [
  "Tel Aviv",
  "Herzliya",
  "Haifa",
  "Jerusalem",
  "Petah Tikva",
  "Ra'anana",
  "Ramat Gan",
  "Be'er Sheva",
  "Netanya",
  "Rehovot",
  "Yokneam",
  "Hod HaSharon",
];
const ROLES = ["fullstack", "backend", "frontend", "devops", "data", "mobile", "qa", "security", "ml"];
const SEN = ["JUNIOR", "MID", "SENIOR", "LEAD"] as const;
const LEVELS = ["ENTRY", "MID", "SENIOR", "LEAD", "MANAGER"] as const;
const MODES = ["ONSITE", "HYBRID", "REMOTE"] as const;
const DOMAINS = ["software", "data", "devops", "security", "qa", "product", "design", "it", "hardware", "other"];
const FUNCS = ["engineering", "data", "product", "design", "sales", "marketing", "other"];
const STATUSES: ApplicationStatus[] = ["SAVED", "APPLIED", "SCREENING", "INTERVIEW", "OFFER", "REJECTED"];
const CATS: ContactCategory[] = ["TEAM_LEAD", "RECRUITER", "PEER", "SENIOR_MGMT", "FOUNDER", "HR"];
const CSTAT: ContactStatus[] = ["NOT_CONTACTED", "SENT", "ACCEPTED", "REPLIED", "REFERRED"];
const LONG =
  "תיאור ארוך במיוחד לבדיקת עומס: אנחנו מחפשים מפתח/ת עם ניסיון רב במערכות מבוזרות בהיקף גבוה, עבודה מול צוותי מוצר ועיצוב, הובלה טכנית של פיצ'רים מקצה לקצה, ותרבות של בדיקות, ניטור ושיפור מתמיד. ";

async function clean() {
  const demo = await db.user.findUnique({ where: { email: "demo@job-hunt.local" } });
  if (demo) {
    await db.referral.deleteMany({ where: { userId: demo.id, note: { startsWith: "stress-" } } });
    await db.contact.deleteMany({ where: { userId: demo.id, notes: { startsWith: "stress-" } } });
    await db.application.deleteMany({ where: { userId: demo.id, notes: { startsWith: "stress-" } } });
    await db.notification.deleteMany({ where: { userId: demo.id, dedupeKey: { startsWith: "stress-" } } });
    await db.savedSearch.deleteMany({ where: { userId: demo.id, name: { startsWith: "stress-" } } });
    await db.salaryDataPoint.deleteMany({ where: { userId: demo.id, source: { startsWith: "stress-" } } });
    await db.emailCandidate.deleteMany({ where: { userId: demo.id, messageId: { startsWith: "stress-" } } });
  }
  await db.company.deleteMany({ where: { slug: { startsWith: "stress-" } } });
}

async function main() {
  await clean();
  if (process.argv.includes("--clean")) return console.log("seed-stress: cleaned");
  const demo = await db.user.findUniqueOrThrow({ where: { email: "demo@job-hunt.local" } });
  const now = Date.now();

  await db.company.createMany({
    data: Array.from({ length: N.companies }, (_, i) => ({
      slug: `stress-co-${i}`,
      name:
        i % 7 === 0 ? `Stress Company With A Very Long Legal Name International Holdings ${i} Ltd.` : `Stress Co ${i}`,
      industry: pick(["SaaS", "Fintech", "Cyber", "Health", "AdTech", "Gaming", "Semiconductors"], i),
      hqLocation: pick(CITIES, i),
      description: LONG.repeat(1 + (i % 3)),
      syncMode: i % 4 === 0 ? ("MANUAL" as const) : ("AUTO" as const),
      careersUrl: `https://example.com/stress-${i}/careers`,
      addedVia: "stress",
    })),
  });
  const cos = await db.company.findMany({
    where: { slug: { startsWith: "stress-" } },
    select: { id: true, name: true, slug: true },
    orderBy: { slug: "asc" },
  });

  for (let b = 0; b < N.jobs; b += 500) {
    await db.job.createMany({
      data: Array.from({ length: Math.min(500, N.jobs - b) }, (_, k) => {
        const i = b + k;
        const tags = Array.from({ length: 3 + (i % 18) }, (_, t) => pick(TECH, i + t));
        return {
          // cos[1] gets ~300 jobs so one company page is a real stress case.
          companyId: i % 10 === 1 ? cos[1].id : pick(cos, i).id,
          externalId: `stress-${i}`,
          source: "MANUAL" as const,
          title:
            i % 5 === 0
              ? `Senior Staff Full Stack Software Engineer, Platform Infrastructure & Developer Experience (${i})`
              : `${pick(["Backend", "Frontend", "Full Stack", "Data", "DevOps"], i)} Engineer ${i}`,
          roleCategory: pick(ROLES, i),
          seniority: pick(SEN, i),
          level: pick(LEVELS, i),
          location: pick(CITIES, i) + (i % 9 === 0 ? ", Israel; Haifa, Israel; Jerusalem, Israel" : ", Israel"),
          workMode: pick(MODES, i),
          techStack: [...new Set(tags)],
          description: LONG.repeat(2 + (i % 4)),
          applyUrl: `https://example.com/stress/jobs/${i}`,
          postedAt: new Date(now - (i % 45) * DAY - i * 1000),
          jobFunction: pick(FUNCS, i),
          domain: pick(DOMAINS, i),
          department: pick(["R&D", "Platform", "Data", "Growth", "Security"], i),
          payMin: i % 6 === 0 ? 25000 + (i % 10) * 1000 : null,
          payMax: i % 6 === 0 ? 35000 + (i % 10) * 1000 : null,
          payCurrency: i % 6 === 0 ? "ILS" : null,
          payPeriod: i % 6 === 0 ? "month" : null,
        };
      }),
    });
  }
  const jobs = await db.job.findMany({
    where: { externalId: { startsWith: "stress-" } },
    select: { id: true, title: true, companyId: true },
    take: N.apps,
  });
  const coName = new Map(cos.map((c) => [c.id, c.name]));

  await db.application.createMany({
    data: jobs.map((j, i) => ({
      userId: demo.id,
      jobId: j.id,
      title: j.title,
      company: coName.get(j.companyId) ?? "Stress Co",
      status: pick(STATUSES, i),
      notes: `stress-${i} ` + (i % 4 === 0 ? LONG : ""),
      appliedAt: new Date(now - (i % 60) * DAY),
      statusChangedAt: new Date(now - (i % 30) * DAY),
      askedSalaryMonthly: i % 5 === 0 ? 30000 + i * 10 : null,
    })),
    skipDuplicates: true,
  });
  const apps = await db.application.findMany({
    where: { userId: demo.id, notes: { startsWith: "stress-" } },
    select: { id: true, jobId: true },
  });

  await db.contact.createMany({
    data: Array.from({ length: N.contacts }, (_, i) => ({
      userId: demo.id,
      companyId: pick(cos, i).id,
      jobId: i % 3 === 0 ? pick(jobs, i).id : null,
      name: i % 6 === 0 ? `איש קשר עם שם ארוך מאוד לבדיקה ${i} בן-דוד-לוי` : `איש קשר ${i}`,
      title: pick(["Team Lead", "Recruiter", "Engineering Manager", "VP R&D", "Talent Acquisition Partner"], i),
      linkedinUrl: `https://www.linkedin.com/in/stress-${i}`,
      category: pick(CATS, i),
      status: pick(CSTAT, i),
      notes: `stress-${i}`,
      insider: i % 4 === 0,
      relationship: i % 4 === 0 ? "עבדנו יחד" : null,
      sentAt: i % 2 === 0 ? new Date(now - (i % 20) * DAY) : null,
      statusAt: new Date(now - (i % 20) * DAY),
    })),
  });
  const contacts = await db.contact.findMany({
    where: { userId: demo.id, notes: { startsWith: "stress-" } },
    select: { id: true },
  });

  await db.referral.createMany({
    data: Array.from({ length: N.referrals }, (_, i) => ({
      userId: demo.id,
      contactId: pick(contacts, i).id,
      applicationId: pick(apps, i).id,
      jobId: pick(apps, i).jobId,
      status: pick(["ASKED", "AGREED", "SUBMITTED", "ANSWERED", "DECLINED"] as const, i),
      note: `stress-${i}`,
      askedAt: new Date(now - (i % 25) * DAY),
      statusAt: new Date(now - (i % 25) * DAY),
    })),
  });

  await db.notification.createMany({
    data: Array.from({ length: N.notifications }, (_, i) => ({
      userId: demo.id,
      kind: pick(["JOB_MATCH", "COMPANY_JOBS", "FOLLOW_UP", "SAVED_JOB_CLOSED"], i),
      title: `התראת עומס ${i}: משרה חדשה שמתאימה לך`,
      body: i % 3 === 0 ? LONG : "גוף קצר",
      url: `/jobs/${pick(jobs, i).id}`,
      dedupeKey: `stress-${i}`,
      readAt: i % 2 ? new Date(now - i * 1000) : null,
      createdAt: new Date(now - i * 3600_000),
    })),
  });

  await db.savedSearch.createMany({
    data: Array.from({ length: N.searches }, (_, i) => ({
      userId: demo.id,
      name: `stress-חיפוש שמור ${i}`,
      query: `q=${pick(TECH, i)}&city=${encodeURIComponent(pick(CITIES, i))}&workMode=${pick(MODES, i)}`,
    })),
  });

  await db.salaryDataPoint.createMany({
    data: Array.from({ length: N.salary }, (_, i) => ({
      userId: demo.id,
      family: pick(["software", "data", "devops", "qa"], i),
      level: pick(["junior", "mid", "senior", "lead"], i),
      city: pick(CITIES, i),
      company: pick(cos, i).name,
      monthlyGrossIls: 20000 + (i % 30) * 1000,
      source: `stress-fixture ${i}`,
      note: i % 3 === 0 ? LONG : null,
    })),
  });

  await db.emailCandidate
    .createMany({
      data: Array.from({ length: 200 }, (_, i) => ({
        userId: demo.id,
        provider: "GMAIL" as const,
        messageId: `stress-${i}`,
        fromAddress: `jobs@stress-${i}.example.com`,
        subject: `Your application to Stress Co ${i} — update on the Senior Engineer role`,
        receivedAt: new Date(now - i * 3600_000),
        kind: "STATUS_UPDATE" as const,
        detectedStatus: pick(STATUSES, i),
        company: `Stress Co ${i}`,
        title: "Senior Engineer",
        confidence: 40 + (i % 60),
        reasons: ["subject", "sender"],
      })),
    })
    .catch((e) => console.warn("emailCandidate skipped:", String(e).slice(0, 160)));

  await db.companyFollow.createMany({
    data: cos.slice(0, 80).map((c) => ({ userId: demo.id, companyId: c.id })),
    skipDuplicates: true,
  });
  console.log("seed-stress: done", N);
}

main().finally(() => db.$disconnect());
