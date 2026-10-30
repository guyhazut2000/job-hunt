import { aiConfig } from "./config";
import { aiEnabled } from "./index";

/** AI calls left for the user in the rolling 24h window, or null when AI is off (mock/offline). */
export async function aiRemaining(userId: string): Promise<number | null> {
  if (!aiEnabled()) return null;
  const { prismaAiStore } = await import("./store");
  const used = await prismaAiStore.countCalls(new Date(Date.now() - 86_400_000), userId);
  return Math.max(0, aiConfig().userDailyLimit - used);
}
