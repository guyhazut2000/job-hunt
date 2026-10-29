import { COMPLEXITY_TABLE } from "@/lib/algo/checklist";
import { tr } from "@/lib/algo/types";
import type { Locale } from "@/lib/i18n/dictionaries";
import type { ProblemSolvingStrings } from "@/lib/i18n/problem-solving";

export function ComplexityTable({ locale, t }: { locale: Locale; t: ProblemSolvingStrings }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm" data-testid="complexity-table">
        <thead className="bg-muted/60 text-start">
          <tr>
            <th className="px-3 py-2 text-start font-semibold">{t.colN}</th>
            <th className="px-3 py-2 text-start font-semibold">{t.colTarget}</th>
            <th className="px-3 py-2 text-start font-semibold">{t.colExamples}</th>
          </tr>
        </thead>
        <tbody>
          {COMPLEXITY_TABLE.map((r) => (
            <tr key={r.n} className="border-t">
              <td dir="ltr" className="px-3 py-2 text-start font-mono whitespace-nowrap">
                {r.n}
              </td>
              <td dir="ltr" className="px-3 py-2 text-start font-mono font-semibold whitespace-nowrap">
                {r.target}
              </td>
              <td className="px-3 py-2">{tr(r.examples, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
