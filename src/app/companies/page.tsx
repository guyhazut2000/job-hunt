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
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t.companies.title}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {companies.map((c) => (
          <Link key={c.id} href={`/companies/${c.slug}`} className="card hover:border-brand-500 block transition">
            <div className="flex items-center gap-3">
              <div className="bg-brand-100 text-brand-700 flex h-10 w-10 items-center justify-center rounded-lg font-bold">
                {c.name[0]}
              </div>
              <div>
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-slate-500">
                  {c.industry} · {c.hqLocation}
                </div>
              </div>
            </div>
            <div className="mt-3 text-sm text-slate-600">
              {c._count.jobs} {t.companies.openRoles}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
