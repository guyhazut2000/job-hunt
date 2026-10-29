import { db } from "@/lib/db";
import type { AttemptLike } from "./engine";

/** Practice attempts cap per user per day (AI calls are separately capped by guardedLLM). */
export const ATTEMPTS_PER_DAY = 60;

/** Graded practice attempts (not paste-mode analyses) for stats / review / next problem. */
export async function practiceAttempts(userId: string): Promise<(AttemptLike & { id: string; picked: string[] })[]> {
  return db.patternAttempt.findMany({
    where: { userId, mode: "practice" },
    select: { id: true, problemId: true, expected: true, picked: true, result: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 2000,
  });
}

export async function attemptsToday(userId: string, now = new Date()): Promise<number> {
  const since = new Date(now);
  since.setHours(0, 0, 0, 0);
  return db.patternAttempt.count({ where: { userId, createdAt: { gte: since } } });
}
