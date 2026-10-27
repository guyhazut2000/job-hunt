/**
 * LOCAL DEMO ONLY: runs the real email-sync pipeline on synthetic emails for one user so the
 * review queue / auto-add can be seen without a Gmail account. Refuses non-localhost databases.
 *
 *   npx tsx scripts/email-sync-demo.ts demo@job-hunt.local [--reset]
 */
import { db } from "../src/lib/db";
import { FIXTURE_EMAILS } from "../src/lib/email/fixtures";
import type { MailMessage } from "../src/lib/email/parse";
import { getSettings, processMessages } from "../src/lib/email/scan";

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "postgres://x").hostname;
  if (!["localhost", "127.0.0.1", "db"].includes(host)) throw new Error(`Refusing to run against ${host}`);
  const email = process.argv[2] ?? "demo@job-hunt.local";
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  if (process.argv.includes("--reset")) {
    const fx = await db.emailCandidate.findMany({ where: { userId: user.id, messageId: { startsWith: "fx-" } } });
    await db.application.deleteMany({
      where: { userId: user.id, source: "EMAIL", emailMessageId: { startsWith: "fx-" } },
    });
    await db.emailCandidate.deleteMany({ where: { id: { in: fx.map((c) => c.id) } } });
  }
  // Two synthetic confirmations about real (local) jobs: one exact, one vague.
  const jobs = await db.job.findMany({
    where: { isActive: true },
    include: { company: true },
    orderBy: { postedAt: "desc" },
    take: 2,
    skip: 3,
  });
  const now = Date.now();
  const extra: MailMessage[] = jobs.flatMap((j, i) =>
    i === 0
      ? [
          {
            id: `fx-live-${j.id}`,
            from: `${j.company.name} Recruiting <no-reply@us.greenhouse-mail.io>`,
            subject: `Thank you for applying to ${j.company.name}`,
            snippet: `Thanks for applying for the ${j.title} position at ${j.company.name}. We'll review your application soon.`,
            date: new Date(now - 2 * 86_400_000),
          },
        ]
      : [
          {
            id: `fx-vague-${j.id}`,
            from: `Talent <careers@${j.company.slug}.example>`,
            subject: "Your application",
            snippet: `Hi! We have received your application to ${j.company.name}. Our team will get back to you.`,
            date: new Date(now - 86_400_000),
          },
        ],
  );
  const pick = ["greenhouse", "unknownCompany", "offer", "interviewHebrew", "weak", "marketing"] as const;
  const messages = [...extra, ...pick.map((k) => ({ ...FIXTURE_EMAILS[k], date: new Date(now - 3 * 86_400_000) }))];
  const settings = await getSettings(user.id);
  const sum = await processMessages(user.id, "GMAIL", messages, { ...settings, confidence: "BALANCED" });
  await db.emailSyncSettings.update({
    where: { userId: user.id },
    data: {
      lastScanAt: new Date(),
      lastScanSummary: { trigger: "fixture", ...sum, durationMs: 0 },
      lastScanError: null,
    },
  });
  console.log(sum);
}

main().finally(() => db.$disconnect());
