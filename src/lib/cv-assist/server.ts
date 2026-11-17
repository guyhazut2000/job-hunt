import "server-only";
/** Loads the user's uploaded CVs and target jobs for the CV builder assist (docs/cv-ai-assist.md). */
import { extractText } from "@/lib/cv/parse";
import { db } from "@/lib/db";
import { heuristicExtract } from "@/lib/profile/extract";
import { professionalSchema } from "@/lib/profile/schema";
import { loadTargetJobs } from "@/lib/skill-suggest/server";
import type { TargetJob, UploadedCv } from "./core";

const MAX_CVS = 5;

export interface UploadedCvs {
  cvs: UploadedCv[];
  /** Raw text of the uploaded CVs (allowed facts for rewrites). */
  text: string;
}

/**
 * The user's uploaded CVs (primary first, newest next), as structured profiles. Uses the profile
 * extracted at upload time (`Resume.extracted`); older uploads without it are re-read from the
 * stored text — or from the stored file with the same parser as the upload — by the rules parser.
 */
export async function loadUploadedCvs(userId: string): Promise<UploadedCvs> {
  const rows = await db.resume.findMany({
    where: { userId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    take: MAX_CVS,
    select: { id: true, fileName: true, label: true, mimeType: true, text: true, extracted: true },
  });
  const cvs: UploadedCv[] = [];
  const texts: string[] = [];
  for (const r of rows) {
    let text = r.text ?? "";
    const parsed = r.extracted ? professionalSchema.safeParse(r.extracted) : null;
    let profile = parsed?.success ? parsed.data : null;
    if (!profile) {
      if (!text.trim()) {
        const file = await db.resumeFile.findUnique({ where: { resumeId: r.id }, select: { data: true } });
        if (file) text = await extractText(Buffer.from(file.data), r.mimeType).catch(() => "");
      }
      if (!text.trim()) continue;
      const h = professionalSchema.safeParse(heuristicExtract(text));
      if (!h.success) continue;
      profile = h.data;
    }
    cvs.push({ label: r.label || r.fileName, profile });
    texts.push(text);
  }
  return { cvs, text: texts.join("\n").slice(0, 60_000) };
}

export async function countUploadedCvs(userId: string): Promise<number> {
  return db.resume.count({ where: { userId } });
}

export async function targetJobs(userId: string): Promise<TargetJob[]> {
  return loadTargetJobs(userId, 5).catch(() => []);
}
