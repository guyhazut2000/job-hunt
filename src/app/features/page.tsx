import type { Metadata } from "next";
import { FeatureExplorer } from "@/components/features/FeatureExplorer";
import { FEATURES, NEW_WINDOW_DAYS, changelog, countsByCategory, isNew } from "@/features";

export const metadata: Metadata = { title: "מה המערכת יודעת לעשות" };
// "New" badges depend on today's date: rebuild the page at most once a day (and on every deploy).
export const revalidate = 86400;

export default function FeaturesPage() {
  const now = new Date();
  const newIds = FEATURES.filter((f) => isNew(f, now)).map((f) => f.id);
  const live = FEATURES.filter((f) => f.status !== "planned").length;
  const planned = FEATURES.length - live;
  const categories = countsByCategory().filter((c) => c.live + c.planned > 0);
  return (
    <div lang="he" dir="rtl" className="flex flex-col gap-8">
      <header className="rule-double motion-safe:animate-rise flex flex-col gap-2 pb-4">
        <p className="kicker">מדריך המערכת</p>
        <h1 className="text-title leading-tight font-black">מה המערכת יודעת לעשות</h1>
        <p className="text-foreground/80 max-w-[65ch] leading-relaxed">
          כל היכולות של job-hunt במקום אחד: מה כל כלי עושה, איך משתמשים בו ואיפה הוא נמצא. העמוד מתעדכן עם כל שינוי
          במערכת. כרגע יש <strong>{live}</strong> יכולות פעילות ו-<strong>{planned}</strong> בתכנון. התג &quot;חדש&quot;
          מסמן יכולות מ-{NEW_WINDOW_DAYS} הימים האחרונים.
        </p>
      </header>
      <FeatureExplorer features={FEATURES} newIds={newIds} categories={categories} changelog={changelog()} />
    </div>
  );
}
