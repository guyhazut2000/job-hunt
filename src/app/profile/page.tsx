import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CompletenessMeter } from "@/components/profile/CompletenessMeter";
import { CvList } from "@/components/profile/CvList";
import { CvUploadForm } from "@/components/profile/CvUploadForm";
import { PreferencesForm } from "@/components/profile/PreferencesForm";
import { ProfessionalForm } from "@/components/profile/ProfessionalForm";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { computeCompleteness } from "@/lib/profile/completeness";
import { readPreferences, readProfessional } from "@/lib/profile/load";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile" };

const TABS = ["pro", "prefs", "cvs"] as const;
type Tab = (typeof TABS)[number];

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { t } = await getDictionary();
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "pro";
  const [profile, resumes] = await Promise.all([
    db.profile.findUnique({ where: { userId: user.id } }),
    db.resume.findMany({
      where: { userId: user.id },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        label: true,
        fileName: true,
        sizeBytes: true,
        isPrimary: true,
        createdAt: true,
        appliedAt: true,
        skills: true,
        file: { select: { id: true } },
      },
    }),
  ]);
  const completeness = computeCompleteness({ hasCv: resumes.length > 0, profile });
  const p = t.pv2;

  return (
    <div className="flex flex-col gap-6">
      <header className="rule-double flex flex-col gap-1 pb-4">
        <p className="kicker">{p.kicker}</p>
        <h1 className="font-heading text-title font-black">{t.profile.title}</h1>
      </header>

      {!profile?.onboardedAt && (
        <Link
          href="/onboarding"
          className="bg-foreground text-background hover:bg-foreground/90 flex min-h-12 items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-semibold"
        >
          {p.onboarding.banner}
          <span className="inline-flex shrink-0 items-center gap-1 underline underline-offset-4">
            {p.onboarding.bannerCta}
            <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
          </span>
        </Link>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_18rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <nav aria-label={t.profile.title} className="bg-muted rounded-lg p-1">
            <ul className="grid grid-cols-3 gap-1">
              {TABS.map((k) => (
                <li key={k}>
                  <Link
                    href={`/profile?tab=${k}`}
                    aria-current={tab === k ? "page" : undefined}
                    className="text-muted-foreground hover:text-foreground aria-[current=page]:bg-card aria-[current=page]:text-foreground flex min-h-11 items-center justify-center rounded-md px-2 text-center text-sm leading-tight font-semibold aria-[current=page]:shadow-sm"
                  >
                    {p.tabs[k]}
                    {k === "cvs" && resumes.length > 0 && (
                      <span className="ms-1.5 font-mono text-xs">{resumes.length}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {tab === "pro" && (
            <ProfessionalForm key={profile?.updatedAt.toISOString()} t={p} initial={readProfessional(profile)} />
          )}
          {tab === "prefs" && (
            <PreferencesForm
              key={profile?.updatedAt.toISOString()}
              t={p}
              roles={t.roles}
              seniority={t.seniority}
              workMode={t.workMode}
              initial={readPreferences(profile)}
            />
          )}
          {tab === "cvs" && (
            <div className="flex flex-col gap-8">
              <section className="flex flex-col gap-3" aria-labelledby="cvs-h">
                <h2 id="cvs-h" className="font-heading text-xl font-bold">
                  {p.cvs}
                </h2>
                <p className="text-muted-foreground text-sm">{p.cvsHint}</p>
                <CvList
                  t={p}
                  dateLocale={t.dateLocale}
                  rows={resumes.map(({ file, ...r }) => ({ ...r, hasFile: !!file }))}
                />
              </section>
              <section className="form-section" aria-labelledby="upload-h">
                <h2 id="upload-h" className="font-heading text-xl font-bold">
                  {p.upload}
                </h2>
                <CvUploadForm t={p} showOptions={resumes.length > 0} />
                <p className="text-muted-foreground text-xs">{p.storageNote}</p>
              </section>
            </div>
          )}
        </div>
        <aside className="order-first lg:sticky lg:top-24 lg:order-none">
          <CompletenessMeter t={p} result={completeness} />
        </aside>
      </div>
    </div>
  );
}
