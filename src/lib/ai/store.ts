import { db } from "../db";
import type { AiStore } from "./guard";

/** Outcomes that consumed provider quota (cache hits and our own refusals do not). */
const COUNTED = ["ok", "error", "rate_limited"];

export const prismaAiStore: AiStore = {
  async getCache(feature, key, now) {
    const row = await db.aiCache.findUnique({ where: { feature_key: { feature, key } } });
    if (!row || row.expiresAt <= now) return null;
    return row.value;
  },
  async putCache(feature, key, model, value, expiresAt) {
    await db.aiCache.upsert({
      where: { feature_key: { feature, key } },
      create: { feature, key, model, value, expiresAt },
      update: { model, value, expiresAt, createdAt: new Date() },
    });
  },
  countCalls(since, userId) {
    return db.aiUsage.count({
      where: { createdAt: { gte: since }, outcome: { in: COUNTED }, ...(userId ? { userId } : {}) },
    });
  },
  async record(entry) {
    await db.aiUsage.create({ data: entry });
  },
};
