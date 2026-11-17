import "server-only";
/** Loads the user's uploaded CVs and target jobs for the CV builder assist (docs/cv-ai-assist.md). */
import type { Prisma } from "@prisma/client";
import { guardedLLM } from "@/lib/ai";
import { extractText } from "@/lib/cv/parse";
import { db } from "@/lib/db";
import { extractProfile, heuristicExtract } from "@/lib/profile/extract";
import { professionalSchema } from "@/lib/profile/schema";
import { loadTargetJobs } from "@/lib/skill-suggest/server";
import { weakExtraction, type TargetJob, type UploadedCv } from "./core";

const MAX_CVS = 5;

export interface UploadedCvs {
  cvs: UploadedCv[];
  /** Raw text of the uploaded CVs (allowed facts for rewrites). */
  text: string;
  /** How the CVs were read this time: stored AI extraction, a fresh AI read, or the rules parser. */
  readBy: "stored" | "ai" | "rules" | "none";
}

export async function loadUploadedCvs(userId: string, opts: { ai?: boolean } = {}): Promise<UploadedCvs> {
  const rows = await db.resume.findMany({
    where: { userId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    take: MAX_CVS,
    select: { id: true, fileName: true, label: true, mimeType: true, text: true, extracted: true },
  });
  const cvs: UploadedCv[] = [];
  const texts: string[] = [];
  let readBy: UploadedCvs["readBy"] = rows.length ? "stored" : "none";
  for (const r of rows) {
    let text = r.text ?? "";
    if (!text.trim()) {
      const file = await db.resumeFile.findUnique({ where: { resumeId: r.id }, select: { data: true } });
      if (file) text = await extractText(Buffer.from(file.data), r.mimeType).catch(() => "");
    }
    const stored = r.extracted ? professionalSchema.safeParse(r.extracted) : null;
    let profile = stored?.success ? stored.data : null;
    const storedSource = (r.extracted as { source?: string } | null)?.source;
    // Uploads from before AI extraction (or a weak rules read) are read again — by the AI when
    // allowed, saved on the resume so it happens once; otherwise by the improved rules parser.
    const reread = !profile || (storedSource !== "llm" && text.trim() && weakExtraction(profile, text));
    if (reread && text.trim()) {
      if (opts.ai) {
        const x = await extractProfile(text, await guardedLLM("cv_extract", userId));
        const p = professionalSchema.safeParse(x);
        if (p.success) {
          profile = p.data;
          if (x.source === "llm") {
            readBy = "ai";
            await db.resume
              .update({ where: { id: r.id }, data: { extracted: x as unknown as Prisma.InputJsonValue } })
              .catch(() => {});
          } else readBy = "rules";
        }
      } else {
        const h = professionalSchema.safeParse(heuristicExtract(text));
        if (h.success) {
          profile = h.data;
          readBy = "rules";
        }
      }
    }
    if (!profile) continue;
    cvs.push({ label: r.label || r.fileName, profile });
    texts.push(text);
  }
  return { cvs, text: texts.join("\n").slice(0, 60_000), readBy };
}

export async function countUploadedCvs(userId: string): Promise<number> {
  return db.resume.count({ where: { userId } });
}

export async function targetJobs(userId: string): Promise<TargetJob[]> {
  return loadTargetJobs(userId, 5).catch(() => []);
}
