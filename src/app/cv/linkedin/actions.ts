"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { guardedLLM } from "@/lib/ai";
import { getLocale } from "@/lib/i18n";
import { aiLimitMessage } from "@/lib/i18n/ai";
import { requireUser } from "@/lib/session";
import { loadLinkedinContext } from "@/lib/linkedin/server";
import {
  linkedinInputSchema,
  linkedinPrompt,
  suggestAbout,
  suggestHeadline,
  validateLinkedinAi,
  type LinkedinInput,
} from "@/lib/linkedin/profile";

const PATH = "/cv/linkedin";

export async function saveLinkedinDraft(input: LinkedinInput): Promise<{ ok: boolean }> {
  const user = await requireUser(PATH);
  const d = linkedinInputSchema.parse(input);
  const data = { ...d, featured: d.featured.map((f) => f.trim()).filter(Boolean) };
  await db.linkedinProfileDraft.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });
  revalidatePath(PATH);
  return { ok: true };
}

export type SuggestResult = {
  ok: true;
  headline: string;
  about: string;
  source: "ai" | "template";
  rejected: boolean;
  limited: string | null;
};

/** Rule-based suggestion from the CV; with AI on, a guarded rephrase that may not add facts. */
export async function suggestLinkedin(input: LinkedinInput, lang: "he" | "en"): Promise<SuggestResult> {
  const user = await requireUser(PATH);
  const l = z.enum(["he", "en"]).catch("he").parse(lang);
  const d = linkedinInputSchema.parse(input);
  const ctx = await loadLinkedinContext(user.id);
  let headline = suggestHeadline(ctx, l);
  let about = suggestAbout(ctx, l);
  let source: "ai" | "template" = "template";
  let rejected = false;
  const llm = await guardedLLM("linkedin_profile", user.id);
  if (llm.name !== "mock" && !ctx.empty) {
    try {
      const raw = await llm.complete(linkedinPrompt(ctx, d, l), { maxTokens: 900, json: true });
      const ok = validateLinkedinAi(raw, ctx, d);
      if (ok) {
        headline = ok.headline;
        about = ok.about;
        source = "ai";
      } else rejected = true;
    } catch {
      // Keep the CV-based suggestion.
    }
  }
  const limited = llm.limited ? aiLimitMessage(llm.limited, await getLocale()) : null;
  await db.linkedinProfileDraft.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...d, suggestions: { headline, about, lang: l }, aiSource: source },
    update: { suggestions: { headline, about, lang: l }, aiSource: source },
  });
  return { ok: true, headline, about, source, rejected, limited };
}
