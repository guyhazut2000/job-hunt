import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { JobCard, JobList } from "@/components/JobCard";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { t } = await getDictionary();
  const [jobs, companies, latest] = await Promise.all([
    db.job.count({ where: { isActive: true } }),
    db.company.count(),
    db.job.findMany({ where: { isActive: true }, include: { company: true }, orderBy: { postedAt: "desc" }, take: 5 }),
  ]);
  return (
    <div className="flex flex-col gap-14 md:gap-20">
      <section className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
        <div className="animate-rise flex flex-col gap-6">
          <p className="kicker flex items-center gap-3">
            <span className="bg-primary inline-block h-px w-8" aria-hidden />
            {t.ui.kicker} · {formatDate(new Date(), t.dateLocale, { weekday: "long" })}
          </p>
          <h1 className="text-display font-black tracking-tight">{t.home.title}</h1>
          <p className="text-foreground/80 max-w-xl text-lg leading-relaxed md:text-xl">{t.home.subtitle}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/jobs">
                {t.home.ctaPrimary}
                <ArrowLeft data-icon="inline-end" aria-hidden className="ltr:rotate-180" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/register">{t.home.ctaSecondary}</Link>
            </Button>
          </div>
          <dl className="rule-double mt-2 grid max-w-md grid-cols-2 border-t-[3px] border-b-0 pt-4">
            <div>
              <dd className="font-mono text-4xl font-medium tabular-nums">{jobs.toLocaleString()}</dd>
              <dt className="text-muted-foreground text-sm">{t.home.stats.jobs}</dt>
            </div>
            <div className="border-s ps-5">
              <dd className="font-mono text-4xl font-medium tabular-nums">{companies.toLocaleString()}</dd>
              <dt className="text-muted-foreground text-sm">{t.home.stats.companies}</dt>
            </div>
          </dl>
        </div>

        <section aria-labelledby="latest" className="flex min-w-0 flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 id="latest" className="kicker text-foreground">
              {t.ui.latest}
            </h2>
            <Link
              href="/jobs"
              className="text-primary inline-flex min-h-11 items-center text-sm font-semibold hover:underline"
            >
              {t.ui.viewAll}
            </Link>
          </div>
          <JobList>
            {latest.map((j) => (
              <JobCard key={j.id} job={j} t={t} />
            ))}
          </JobList>
        </section>
      </section>

      <section className="border-foreground grid gap-x-8 gap-y-8 border-t-2 pt-8 sm:grid-cols-2 lg:grid-cols-4">
        {t.home.features.map((f, i) => (
          <div key={f.title} className="flex flex-col gap-2">
            <span className="text-primary font-mono text-sm">{String(i + 1).padStart(2, "0")}</span>
            <h2 className="font-heading text-xl font-bold">{f.title}</h2>
            <p className="text-muted-foreground leading-relaxed">{f.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
