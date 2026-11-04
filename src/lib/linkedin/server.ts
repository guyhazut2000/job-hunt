import { db } from "@/lib/db";
import { loadCvSource } from "@/lib/cv-templates/server";
import { readPreferences } from "@/lib/profile/load";
import { EMPTY_LINKEDIN, linkedinInputSchema, type LinkedinContext, type LinkedinInput } from "./profile";

export async function loadLinkedinContext(userId: string): Promise<LinkedinContext & { empty: boolean }> {
  const [src, profile] = await Promise.all([loadCvSource(userId), db.profile.findUnique({ where: { userId } })]);
  return { cv: src.content, targetRoles: readPreferences(profile).targetRoles, empty: src.empty };
}

export async function loadLinkedinDraft(userId: string): Promise<{
  input: LinkedinInput;
  suggestions: { headline: string; about: string; lang: string } | null;
  aiSource: string | null;
}> {
  const row = await db.linkedinProfileDraft.findUnique({ where: { userId } });
  if (!row) return { input: EMPTY_LINKEDIN, suggestions: null, aiSource: null };
  const sug = row.suggestions as { headline?: unknown; about?: unknown; lang?: unknown } | null;
  return {
    input: linkedinInputSchema.parse(row),
    suggestions:
      sug && typeof sug.headline === "string" && typeof sug.about === "string"
        ? { headline: sug.headline, about: sug.about, lang: String(sug.lang ?? "he") }
        : null,
    aiSource: row.aiSource,
  };
}
