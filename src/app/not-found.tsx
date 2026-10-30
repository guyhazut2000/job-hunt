import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getLocale } from "@/lib/i18n";

const STRINGS = {
  he: {
    title: "הדף לא נמצא",
    lead: "ייתכן שהקישור שגוי או שהדף הוסר.",
    jobs: "לחיפוש משרות",
    home: "לדף הבית",
  },
  en: {
    title: "Page not found",
    lead: "The link may be wrong, or the page was removed.",
    jobs: "Browse jobs",
    home: "Home",
  },
} as const;

export default async function NotFound() {
  const locale = await getLocale();
  const t = STRINGS[locale === "en" ? "en" : "he"];
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <p className="kicker" dir="ltr">
        404
      </p>
      <h1 className="text-display font-black">{t.title}</h1>
      <p className="text-muted-foreground">{t.lead}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/jobs">{t.jobs}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">{t.home}</Link>
        </Button>
      </div>
    </div>
  );
}
