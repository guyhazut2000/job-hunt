import Link from "next/link";
import { TruncatedText } from "@/components/TruncatedText";
import { db } from "@/lib/db";
import { groupByLetter, HEBREW, LATIN, letterAnchor, OTHER } from "@/lib/alpha";
import { getDictionary } from "@/lib/i18n";
import { BackToTop } from "@/components/BackToTop";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Companies" };

export default async function CompaniesPage() {
  const { t } = await getDictionary();
  const companies = await db.company.findMany({
    include: { _count: { select: { jobs: { where: { isActive: true } } } } },
    orderBy: { name: "asc" },
  });
  const hiring = companies.filter((c) => c._count.jobs > 0).length;
  const groups = groupByLetter(companies, (c) => c.name);
  const present = new Set(groups.map((g) => g.letter));
  // Full Latin row (missing letters shown disabled); Hebrew letters and "#" only when used.
  const jump = [
    { key: "latin", dir: "ltr" as const, letters: LATIN },
    { key: "hebrew", dir: "rtl" as const, letters: HEBREW.filter((l) => present.has(l)) },
    { key: "other", dir: "ltr" as const, letters: present.has(OTHER) ? [OTHER] : [] },
  ].filter((g) => g.letters.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="rule-double flex flex-wrap items-end justify-between gap-3 pb-4">
        <div>
          <p className="kicker">{t.ui.kicker}</p>
          <h1 className="text-title mt-1 font-black">{t.companies.title}</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          <span className="text-foreground font-mono font-medium">{hiring}</span> {t.ui.hiringNow}
        </p>
      </header>

      {groups.length > 1 && (
        <nav
          aria-label={t.companies.jumpTo}
          className="bg-background/92 sticky top-(--header-h) z-30 -mx-4 border-b px-4 py-2 backdrop-blur-md md:-mx-6 md:px-6"
        >
          {/* LTR track so the bar opens at "A" (sections run Latin → Hebrew → #) */}
          <ul dir="ltr" className="no-scrollbar flex items-center gap-x-3 overflow-x-auto overscroll-x-contain">
            {jump.map((g) => (
              <li key={g.key} className="shrink-0">
                <ul dir={g.dir} className="flex items-center">
                  {g.letters.map((l) => {
                    const label = l === OTHER ? t.companies.other : l;
                    const cls =
                      "grid h-9 min-w-8 place-items-center rounded-md px-1 font-mono text-sm font-medium md:h-8 md:min-w-7";
                    return (
                      <li key={l}>
                        {present.has(l) ? (
                          <a
                            href={`#${letterAnchor(l)}`}
                            aria-label={`${t.companies.jumpTo}: ${label}`}
                            className={cn(cls, "text-foreground hover:bg-muted focus-visible:bg-muted")}
                          >
                            {l}
                          </a>
                        ) : (
                          <span
                            aria-disabled="true"
                            title={`${t.companies.noneFor} ${label}`}
                            className={cn(cls, "text-muted-foreground/45 cursor-default")}
                          >
                            {l}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="flex flex-col gap-8">
        {groups.map((g) => {
          const id = letterAnchor(g.letter);
          return (
            <section
              key={g.letter}
              id={id}
              aria-labelledby={`${id}-h`}
              className="scroll-mt-[calc(var(--header-h)+4rem)]"
            >
              <div className="border-rule mb-3 flex items-baseline gap-3 border-b-2 pb-1.5">
                <h2 id={`${id}-h`} className="font-heading text-3xl leading-none font-black">
                  {g.letter === OTHER ? <span aria-label={t.companies.other}>#</span> : g.letter}
                </h2>
                <span className="text-muted-foreground font-mono text-xs">{g.items.length}</span>
              </div>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
                {g.items.map((c) => {
                  const meta = [c.industry, c.hqLocation].filter(Boolean).join(" · ");
                  return (
                    <li key={c.id} className="bg-card min-w-0 overflow-hidden rounded-lg border">
                      <Link
                        href={`/companies/${c.slug}`}
                        className="group hover:bg-muted/60 flex h-full min-h-20 items-center gap-4 px-4 py-4 transition-colors"
                      >
                        <span
                          aria-hidden
                          className="bg-foreground text-background grid size-11 shrink-0 place-items-center rounded-md font-mono text-lg font-medium uppercase"
                        >
                          {g.letter === OTHER ? c.name.trim()[0] : g.letter}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <TruncatedText
                            text={c.name}
                            lines={2}
                            className="font-heading group-hover:text-primary text-lg leading-tight font-bold"
                          />
                          {meta && (
                            <TruncatedText text={meta} side="bottom" className="text-muted-foreground text-sm" />
                          )}
                        </span>
                        <span className="flex shrink-0 flex-col items-end text-end">
                          <span
                            className={
                              c._count.jobs > 0
                                ? "text-fit font-mono text-xl leading-none font-medium"
                                : "text-muted-foreground font-mono text-xl leading-none"
                            }
                          >
                            {c._count.jobs}
                          </span>
                          <span className="text-muted-foreground text-[0.7rem]">{t.companies.openRoles}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <BackToTop label={t.ui.backToTop} />
    </div>
  );
}
