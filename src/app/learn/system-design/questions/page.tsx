import Link from "next/link";
import { ShowMoreList } from "@/components/density/ShowMoreList";
import { PageHead } from "@/components/problem-solving/PageHead";
import { tr } from "@/lib/algo/types";
import { getLocale } from "@/lib/i18n";
import { densityStrings } from "@/lib/i18n/density";
import { systemDesignStrings } from "@/lib/i18n/system-design";
import { localizedTitle } from "@/lib/i18n/titles";
import { SD_QUESTIONS, type SdKind } from "@/lib/sysdesign/content";
import { cn } from "@/lib/utils";

export const generateMetadata = localizedTitle("sdQuestions");

const KINDS: (SdKind | "all")[] = ["all", "frontend", "fullstack", "backend", "ai"];

export default async function SystemDesignQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const locale = await getLocale();
  const t = systemDesignStrings(locale);
  const sp = await searchParams;
  const kind = KINDS.includes(sp.kind as SdKind) ? (sp.kind as SdKind | "all") : "all";
  const list = kind === "all" ? SD_QUESTIONS : SD_QUESTIONS.filter((q) => q.kind === kind);
  const block = (title: string, items: { he: string; en: string }[]) => (
    <div>
      <p className="text-xs font-semibold">{title}</p>
      <ul className="list-disc ps-5 text-sm">
        {items.map((x, i) => (
          <li key={i}>{tr(x, locale)}</li>
        ))}
      </ul>
    </div>
  );
  return (
    <div className="flex flex-col gap-6" data-testid="sd-questions-page">
      <PageHead kicker={t.kicker} title={t.qTitle} lead={t.qLead} />
      <nav aria-label={t.qTitle} className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <Link
            key={k}
            href={k === "all" ? "/learn/system-design/questions" : `/learn/system-design/questions?kind=${k}`}
            aria-current={k === kind ? "page" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-semibold",
              k === kind ? "bg-foreground text-background border-foreground" : "bg-card hover:bg-muted",
            )}
          >
            {t.kinds[k]}
          </Link>
        ))}
      </nav>
      <ShowMoreList
        key={kind}
        initial={6}
        step={6}
        s={densityStrings(locale)}
        testId="sd-questions"
        label={t.qTitle}
        className="grid gap-3 md:grid-cols-2"
      >
        {list.map((q) => (
          <li key={q.id} id={q.id} className="bg-card min-w-0 rounded-xl border">
            <details className="group p-4">
              <summary className="flex cursor-pointer list-none items-baseline justify-between gap-2">
                <span className="font-bold">{tr(q.title, locale)}</span>
                <span className="bg-muted shrink-0 rounded-full px-2 py-0.5 text-xs">{t.kinds[q.kind]}</span>
              </summary>
              <div className="mt-3 flex flex-col gap-2">
                {block(t.clarify, q.clarify)}
                {block(t.core, q.core)}
                {block(t.deepDive, q.deepDive)}
                <p className="text-sm">
                  <span className="text-caution font-semibold">{t.pitfall}: </span>
                  {tr(q.pitfall, locale)}
                </p>
              </div>
            </details>
          </li>
        ))}
      </ShowMoreList>
      <Link href="/interview" className="text-primary self-start text-sm font-semibold underline">
        {t.practiceSim}
      </Link>
    </div>
  );
}
