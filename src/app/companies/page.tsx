import Link from "next/link";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Companies" };

export default async function CompaniesPage() {
  const { t } = await getDictionary();
  const companies = await db.company.findMany({
    include: { _count: { select: { jobs: { where: { isActive: true } } } } },
    orderBy: { name: "asc" },
  });
  const hiring = companies.filter((c) => c._count.jobs > 0).length;
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
      <ul className="bg-border grid gap-px overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-3">
        {companies.map((c) => (
          <li key={c.id} className="bg-card">
            <Link
              href={`/companies/${c.slug}`}
              className="group hover:bg-muted/60 flex h-full min-h-20 items-center gap-4 px-4 py-4 transition-colors"
            >
              <span
                aria-hidden
                className="bg-foreground text-background grid size-11 shrink-0 place-items-center rounded-md font-mono text-lg font-medium uppercase"
              >
                {c.name[0]}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-heading group-hover:text-primary truncate text-lg leading-tight font-bold">
                  {c.name}
                </span>
                <span className="text-muted-foreground truncate text-sm">
                  {[c.industry, c.hqLocation].filter(Boolean).join(" · ")}
                </span>
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
        ))}
      </ul>
    </div>
  );
}
