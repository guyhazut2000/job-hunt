import { runWeeklyCoach } from "@/lib/coach/run";
import { runDigests } from "@/lib/digest/run";
import { runClosingReminders } from "./closing";
import { processDeliveries } from "./deliver";
import { runInterviewReminders } from "./interviews";
import { runLearningReminders } from "./learning";
import { runStageChanges } from "./stage-change";

/**
 * The hourly cron: interview reminders (~24h / ~2h before), home-assignment and referee-brief reminders, hiring-stage changes, study reminders in each user's slot,
 * daily digests whose hour has passed, the weekly coach (Sundays), then the push/Telegram send queue. Each step is isolated.
 */
export async function runHourly(now = new Date()) {
  const safe = <T>(p: Promise<T>) => p.catch((e: unknown) => ({ error: e instanceof Error ? e.message : "error" }));
  const interviews = await safe(runInterviewReminders(now));
  const closing = await safe(runClosingReminders(now));
  const stages = await safe(runStageChanges(now));
  const learning = await safe(runLearningReminders(now));
  const digests = await safe(runDigests(now));
  const coach = await safe(runWeeklyCoach(now));
  const deliveries = await safe(processDeliveries({ now }));
  return { interviews, closing, stages, learning, digests, coach, deliveries };
}
