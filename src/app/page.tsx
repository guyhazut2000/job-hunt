import Link from "next/link";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { t } = await getDictionary();
  const [jobs, companies] = await Promise.all([db.job.count({ where: { isActive: true } }), db.company.count()]);
  return (
    <div className="space-y-14">
      <section className="space-y-6 py-10 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl leading-tight font-bold sm:text-5xl">{t.home.title}</h1>
        <p className="mx-auto max-w-2xl text-lg text-slate-600">{t.home.subtitle}</p>
        <div className="flex justify-center gap-3">
          <Link href="/jobs" className="btn-primary px-6 py-3 text-base">
            {t.home.ctaPrimary}
          </Link>
          <Link href="/register" className="btn-ghost px-6 py-3 text-base">
            {t.home.ctaSecondary}
          </Link>
        </div>
        <div className="flex justify-center gap-10 pt-4 text-slate-600">
          <div>
            <div className="text-ink text-3xl font-bold">{jobs.toLocaleString()}</div>
            {t.home.stats.jobs}
          </div>
          <div>
            <div className="text-ink text-3xl font-bold">{companies.toLocaleString()}</div>
            {t.home.stats.companies}
          </div>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {t.home.features.map((f) => (
          <div key={f.title} className="card">
            <h2 className="mb-2 font-semibold">{f.title}</h2>
            <p className="text-sm text-slate-600">{f.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
