import { MessageSquareQuote } from "lucide-react";
import { PageHead } from "@/components/problem-solving/PageHead";
import { COMMUNICATION_TIPS, EDGE_CASES, INTERVIEW_STEPS } from "@/lib/algo/best-practices";
import { tr } from "@/lib/algo/types";
import { getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/learning";
import { problemSolvingStrings } from "@/lib/i18n/problem-solving";

export const metadata = { title: "Interview method" };

export default async function InterviewPage() {
  const locale = await getLocale();
  const t = problemSolvingStrings(locale);
  return (
    <div className="flex flex-col gap-8">
      <PageHead kicker={t.title} title={t.interviewTitle} lead={t.interviewLead} />
      <ol className="flex flex-col gap-3" data-testid="interview-steps">
        {INTERVIEW_STEPS.map((s) => (
          <li key={s.id} className="bg-card flex flex-col gap-2.5 rounded-xl border p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-black">{tr(s.title, locale)}</h2>
              <span dir="auto" className="text-muted-foreground font-mono text-xs">
                {fmt(t.minutes, { n: s.minutes })}
              </span>
            </div>
            <ul className="flex list-disc flex-col gap-1 ps-5 text-sm leading-relaxed">
              {s.points.map((p) => (
                <li key={p.en}>{tr(p, locale)}</li>
              ))}
            </ul>
            <p className="bg-muted/60 flex items-start gap-2 rounded-lg px-3 py-2 text-sm italic">
              <MessageSquareQuote className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <span className="sr-only">{t.sayIt}: </span>“{tr(s.say, locale)}”
              </span>
            </p>
          </li>
        ))}
      </ol>
      <div className="grid gap-6 sm:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h2 className="kicker">{t.communication}</h2>
          <ul className="flex list-disc flex-col gap-1 ps-5 text-sm leading-relaxed">
            {COMMUNICATION_TIPS.map((x) => (
              <li key={x.en}>{tr(x, locale)}</li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="kicker">{t.edgeCases}</h2>
          <ul className="flex list-disc flex-col gap-1 ps-5 text-sm leading-relaxed">
            {EDGE_CASES.map((x) => (
              <li key={x.en}>{tr(x, locale)}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
