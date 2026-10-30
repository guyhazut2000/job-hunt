import { PageHead } from "@/components/problem-solving/PageHead";
import { PrintButton } from "@/components/problem-solving/PrintButton";
import { INTERVIEW_STEPS } from "@/lib/algo/best-practices";
import { COMPLEXITY_TABLE, GUIDE } from "@/lib/algo/checklist";
import { tr } from "@/lib/algo/types";
import { getLocale } from "@/lib/i18n";
import { problemSolvingStrings } from "@/lib/i18n/problem-solving";
import { localizedTitle } from "@/lib/i18n/titles";

export const generateMetadata = localizedTitle("psChecklist");

// Print: hide site chrome so the checklist fits one A4 page.
const PRINT_CSS = `@media print {
  header, footer, nav, [data-print-hide], [data-bottom-nav] { display: none !important; }
  body { background: #fff !important; }
  main { padding: 0 !important; margin: 0 !important; max-width: none !important; }
  .print-sheet { font-size: 10.5pt; gap: 8px !important; }
  @page { size: A4; margin: 12mm; }
}`;

export default async function ChecklistPage() {
  const locale = await getLocale();
  const t = problemSolvingStrings(locale);
  return (
    <div className="print-sheet flex flex-col gap-6">
      <style>{PRINT_CSS}</style>
      <PageHead kicker={t.title} title={t.checklistTitle} lead={t.checklistLead}>
        <PrintButton label={t.print} />
      </PageHead>
      <ol className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2" data-testid="print-checklist">
        {GUIDE.map((q, i) => (
          <li key={q.id} className="flex break-inside-avoid gap-2.5">
            <span aria-hidden className="mt-0.5 size-4 shrink-0 rounded border-2" />
            <div className="flex flex-col gap-0.5">
              <p className="font-bold">
                {i + 1}. {tr(q.q, locale)}
              </p>
              <p className="text-foreground/70 text-sm leading-snug">
                {q.options.map((o) => tr(o.label, locale)).join(" · ")}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <div className="grid gap-6 sm:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-black">{t.complexityTitle}</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {COMPLEXITY_TABLE.map((r) => (
              <li key={r.n} className="flex flex-wrap gap-x-2" dir="ltr">
                <span className="font-mono">{r.n}</span>
                <span>→</span>
                <span className="font-mono font-semibold">{r.target}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-black">{t.checklistSteps}</h2>
          <ol className="flex flex-col gap-1 text-sm">
            {INTERVIEW_STEPS.map((s) => (
              <li key={s.id}>
                <span className="font-semibold">{tr(s.title, locale)}</span>
                <span className="text-foreground/70"> – {tr(s.points[0], locale)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
