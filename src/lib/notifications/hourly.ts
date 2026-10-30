import { runDigests } from "@/lib/digest/run";
import { processDeliveries } from "./deliver";
import { runInterviewReminders } from "./interviews";
import { runLearningReminders } from "./learning";
import { runStageChanges } from "./stage-change";

/**
 * The hourly cron: interview reminders (~24h / ~2h before), hiring-stage changes, study reminders in each user's slot,
 * daily digests whose hour has passed, then the push/Telegram send queue. Each step is isolated.
 */
export async function runHourly(now = new Date()) {
  const safe = <T>(p: Promise<T>) => p.catch((e: unknown) => ({ error: e instanceof Error ? e.message : "error" }));
  const interviews = await safe(runInterviewReminders(now));
  const stages = await safe(runStageChanges(now));
  const learning = await safe(runLearningReminders(now));
  const digests = await safe(runDigests(now));
  const deliveries = await safe(processDeliveries({ now }));
  return { interviews, stages, learning, digests, deliveries };
}
