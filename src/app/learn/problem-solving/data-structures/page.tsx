import Link from "next/link";
import { PageHead } from "@/components/problem-solving/PageHead";
import { DATA_STRUCTURES } from "@/lib/algo/data-structures";
import { PATTERNS } from "@/lib/algo/patterns";
import { tr } from "@/lib/algo/types";
import { getLocale } from "@/lib/i18n";
import { problemSolvingStrings } from "@/lib/i18n/problem-solving";
import { localizedTitle } from "@/lib/i18n/titles";

export const generateMetadata = localizedTitle("psDataStructures");

export default async function DataStructuresPage() {
  const locale = await getLocale();
  const t = problemSolvingStrings(locale);
  return (
    <div className="flex flex-col gap-8">
      <PageHead kicker={t.title} title={t.dsTitle} lead={t.dsLead} />
      <ul className="grid gap-4 lg:grid-cols-2">
        {DATA_STRUCTURES.map((d) => {
          const users = PATTERNS.filter((p) => p.uses.includes(d.id));
          return (
            <li
              key={d.id}
              id={d.id}
              className="bg-card flex min-w-0 scroll-mt-24 flex-col gap-3 rounded-xl border p-4 sm:p-5"
              data-testid="ds-card"
            >
              <div className="flex flex-col gap-1">
                <h2 dir="ltr" className="text-start text-lg font-black rtl:text-end">
                  {d.name}
                </h2>
                <p className="text-foreground/80 text-sm leading-relaxed">{tr(d.summary, locale)}</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-xs">
                    <th className="py-1 text-start font-semibold">{t.op}</th>
                    <th className="py-1 text-start font-semibold">{t.cost}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.ops.map((o) => (
                    <tr key={o.op} className="border-t align-top">
                      <td className="py-1.5 pe-2">
                        <span dir="ltr" className="font-mono text-[0.8rem]">
                          {o.op}
                        </span>
                        {o.note && <span className="text-muted-foreground block text-xs">{tr(o.note, locale)}</span>}
                      </td>
                      <td dir="ltr" className="py-1.5 text-start font-mono font-semibold break-words rtl:text-end">
                        {o.cost}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <h3 className="kicker text-fit">{t.whenToUse}</h3>
                  <ul className="flex list-disc flex-col gap-0.5 ps-5 text-sm">
                    {d.whenToUse.map((w) => (
                      <li key={w.en}>{tr(w, locale)}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="kicker text-caution">{t.pitfalls}</h3>
                  <ul className="flex list-disc flex-col gap-0.5 ps-5 text-sm">
                    {d.pitfalls.map((w) => (
                      <li key={w.en}>{tr(w, locale)}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {users.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {users.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/learn/problem-solving/patterns/${p.id}`}
                        dir="ltr"
                        className="bg-secondary hover:bg-muted inline-flex min-h-8 items-center rounded-full px-2.5 text-xs"
                      >
                        {p.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
