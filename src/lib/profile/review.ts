import { db } from "../db";
import type { ExtractedProfile } from "./extract";
import { readProfessional } from "./load";
import { mergeProfessional } from "./merge";
import { professionalSchema } from "./schema";

/** Proposal for the review screen: the user's current profile merged with what this CV yielded. */
export async function loadReview(userId: string, resumeId: string) {
  const [resume, profile] = await Promise.all([
    db.resume.findFirst({
      where: { id: resumeId, userId },
      select: { id: true, fileName: true, label: true, extracted: true },
    }),
    db.profile.findUnique({ where: { userId } }),
  ]);
  if (!resume) return null;
  const parsed = professionalSchema.safeParse(resume.extracted ?? {});
  const extracted = {
    ...(parsed.success ? parsed.data : professionalSchema.parse({})),
    targetRoles: [],
    targetSeniorities: [],
    source: ((resume.extracted as { source?: string } | null)?.source === "llm"
      ? "llm"
      : "heuristic") as ExtractedProfile["source"],
  } satisfies ExtractedProfile;
  return { resume, proposal: mergeProfessional(readProfessional(profile), extracted), source: extracted.source };
}
