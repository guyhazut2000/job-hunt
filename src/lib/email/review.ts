import { db } from "@/lib/db";
import { formatIsraelDate } from "./format";
import { bestCompany, titleSimilarity } from "./match";
import { parseFrom } from "./parse";
import { messageUrl } from "./providers";

export type ReviewItem = {
  id: string;
  kind: "APPLICATION" | "STATUS_UPDATE";
  detectedStatus: string | null;
  subject: string;
  sender: string;
  dateLabel: string;
  company: string | null;
  title: string | null;
  confidence: number;
  link: string;
  jobOptions: { id: string; label: string }[];
  appOptions: { id: string; label: string }[];
  defaultJobId: string | null;
  defaultAppId: string | null;
};

/** Pending review queue with suggested jobs (same company first) and existing applications. */
export async function getReviewItems(userId: string, locale: string): Promise<ReviewItem[]> {
  const pending = await db.emailCandidate.findMany({
    where: { userId, status: "PENDING" },
    orderBy: { receivedAt: "desc" },
    take: 30,
  });
  if (!pending.length) return [];
  const [companies, apps] = await Promise.all([
    db.company.findMany({ select: { id: true, name: true, slug: true, website: true } }),
    db.application.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, company: true },
    }),
  ]);

  const items: ReviewItem[] = [];
  for (const c of pending) {
    const from = parseFrom(c.fromAddress);
    const hit = bestCompany(c.company, companies);
    const jobs =
      hit && hit.score >= 0.7
        ? await db.job.findMany({
            where: { companyId: hit.company.id },
            select: { id: true, title: true, isActive: true },
            orderBy: [{ isActive: "desc" }, { postedAt: "desc" }],
            take: 50,
          })
        : [];
    const ranked = jobs
      .map((j) => ({ ...j, s: c.title ? titleSimilarity(c.title, j.title) : 0 }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 12);
    if (c.matchedJobId && !ranked.some((j) => j.id === c.matchedJobId)) {
      const j = await db.job.findUnique({
        where: { id: c.matchedJobId },
        select: { id: true, title: true, isActive: true },
      });
      if (j) ranked.unshift({ ...j, s: 1 });
    }
    const companyName = hit && hit.score >= 0.7 ? hit.company.name : c.company;
    items.push({
      id: c.id,
      kind: c.kind,
      detectedStatus: c.detectedStatus,
      subject: c.subject,
      sender: from.name || from.address,
      dateLabel: formatIsraelDate(c.receivedAt, locale),
      company: c.company,
      title: c.title,
      confidence: c.confidence,
      link: messageUrl(c.provider, c.messageId),
      jobOptions: ranked.map((j) => ({ id: j.id, label: `${j.title} · ${companyName ?? ""}` })),
      appOptions: apps.map((a) => ({ id: a.id, label: `${a.title} · ${a.company}` })),
      defaultJobId: c.matchedJobId ?? (ranked[0] && ranked[0].s >= 0.6 ? ranked[0].id : null),
      defaultAppId: c.applicationId,
    });
  }
  return items;
}
