import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { comeetAdapter } from "../src/lib/ingestion/adapters/comeet";
import { greenhouseAdapter } from "../src/lib/ingestion/adapters/greenhouse";
import { leverAdapter } from "../src/lib/ingestion/adapters/lever";
import { DEMO_COMPANIES, demoRawJobs } from "../src/lib/ingestion/fixtures";
import { JOB_SOURCES } from "../src/lib/ingestion/sources";

const db = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@job-hunt.local";
  const password = process.env.SEED_PASSWORD ?? "password123";
  const hash = await bcrypt.hash(password, 10);

  await db.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: "Admin",
      passwordHash: hash,
      role: "ADMIN",
      profile: { create: { skills: [] } },
    },
    update: { role: "ADMIN" },
  });
  await db.user.upsert({
    where: { email: "demo@job-hunt.local" },
    create: {
      email: "demo@job-hunt.local",
      name: "Demo User",
      passwordHash: hash,
      profile: {
        create: {
          headline: "Full Stack Developer",
          desiredRole: "fullstack",
          seniority: "MID",
          location: "Tel Aviv",
          workMode: "HYBRID",
          yearsExperience: 4,
          skills: ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "Docker"],
        },
      },
    },
    update: {},
  });

  // Real companies (public Greenhouse/Lever boards). No network here — run ingestion to fetch their jobs.
  for (const s of JOB_SOURCES) {
    const managed = {
      name: s.name,
      website: s.website,
      industry: s.industry,
      hqLocation: s.hqLocation,
      atsProvider: s.provider,
      atsBoardId: s.boardId,
    };
    await db.company.upsert({ where: { slug: s.slug }, create: { slug: s.slug, ...managed }, update: managed });
  }

  // Fictional demo companies/jobs are for local development only — never production.
  const seedDemo = process.env.SEED_DEMO_DATA !== "false" && process.env.VERCEL_ENV !== "production";
  if (!seedDemo) {
    console.log(
      `Synced ${JOB_SOURCES.length} real sources (demo data skipped). Users: ${adminEmail}, demo@job-hunt.local`,
    );
    return;
  }
  let jobs = 0;
  for (const [i, c] of DEMO_COMPANIES.entries()) {
    const company = await db.company.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        name: c.name,
        industry: c.industry,
        size: c.size,
        hqLocation: c.hqLocation,
        description: c.description,
        website: `https://example.com/${c.slug}`,
      },
      update: { description: c.description },
    });
    for (const raw of demoRawJobs(c, i)) {
      const normalized = raw.greenhouse
        ? greenhouseAdapter.normalize(raw.greenhouse)
        : raw.lever
          ? leverAdapter.normalize(raw.lever)
          : comeetAdapter.normalize(raw.comeet!);
      if (!normalized) continue;
      await db.job.upsert({
        where: { source_externalId: { source: normalized.source, externalId: normalized.externalId } },
        create: { ...normalized, companyId: company.id },
        update: { ...normalized },
      });
      jobs++;
    }
  }
  console.log(
    `Synced ${JOB_SOURCES.length} real sources; seeded ${DEMO_COMPANIES.length} demo companies, ${jobs} demo jobs. Users: ${adminEmail}, demo@job-hunt.local (password: ${password})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
