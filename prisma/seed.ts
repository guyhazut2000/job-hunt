import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { comeetAdapter } from "../src/lib/ingestion/adapters/comeet";
import { greenhouseAdapter } from "../src/lib/ingestion/adapters/greenhouse";
import { leverAdapter } from "../src/lib/ingestion/adapters/lever";
import { DEMO_COMPANIES, demoRawJobs } from "../src/lib/ingestion/fixtures";

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
    `Seeded ${DEMO_COMPANIES.length} companies, ${jobs} jobs. Users: ${adminEmail}, demo@job-hunt.local (password: ${password})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
