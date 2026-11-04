import "server-only";
import { guardedLLM } from "@/lib/ai";
import { AiLimitError } from "@/lib/ai/errors";
import { db } from "@/lib/db";
import { heuristicScan, scanAiSchema, scanPrompt, validateAiScan, type ScanResult } from "./analysis";
import type { Lang } from "./checklist";

/** Offer owned by the user, with its closing row (created on first visit). Null when not theirs. */
export async function loadOfferClosing(userId: string, offerId: string) {
  const offer = await db.jobOffer.findFirst({
    where: { id: offerId, userId },
    select: {
      id: true,
      label: true,
      data: true,
      acceptedAt: true,
      applicationId: true,
      application: { select: { id: true, title: true, company: true, status: true } },
    },
  });
  if (!offer) return null;
  const closing = await db.offerClosing.upsert({
    where: { offerId: offer.id },
    create: { userId, offerId: offer.id },
    update: {},
  });
  return { offer, closing };
}

/** Contract scan: AI (feature "contract_review", quota-guarded) with a keyword fallback. Never throws. */
export async function scanContract(userId: string, text: string, lang: Lang, now = new Date()): Promise<ScanResult> {
  const llm = await guardedLLM("contract_review", userId);
  if (llm.name === "mock") return heuristicScan(text, now);
  try {
    const raw = await llm.complete(scanPrompt(text, lang), { schema: scanAiSchema, maxTokens: 2500 });
    return validateAiScan(JSON.parse(raw), text, now) ?? heuristicScan(text, now);
  } catch (e) {
    if (e instanceof AiLimitError) return heuristicScan(text, now, "limited");
    return heuristicScan(text, now);
  }
}
