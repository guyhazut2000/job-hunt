import type { AiLimitReason } from "../ai/errors";
import type { Locale } from "./dictionaries";

const he: Record<AiLimitReason, string> = {
  user_daily: "ניצלת את מכסת ה-AI היומית שלך. בינתיים מוצגות המלצות בסיסיות, והמכסה מתחדשת תוך 24 שעות.",
  global_daily: "שירות ה-AI עמוס היום. בינתיים מוצגות המלצות בסיסיות, נסה שוב מחר.",
  global_minute: "יותר מדי בקשות AI בדקה האחרונה. בינתיים מוצגות המלצות בסיסיות, נסה שוב בעוד דקה.",
  provider_quota: "שירות ה-AI עמוס כרגע. בינתיים מוצגות המלצות בסיסיות, נסה שוב מאוחר יותר.",
};

const en: typeof he = {
  user_daily: "You've used today's AI allowance. Showing basic suggestions for now; it renews within 24 hours.",
  global_daily: "The AI service is busy today. Showing basic suggestions for now; try again tomorrow.",
  global_minute: "Too many AI requests in the last minute. Showing basic suggestions; try again in a minute.",
  provider_quota: "The AI service is busy right now. Showing basic suggestions; try again later.",
};

export function aiLimitMessage(reason: AiLimitReason, locale: Locale): string {
  return (locale === "en" ? en : he)[reason];
}
