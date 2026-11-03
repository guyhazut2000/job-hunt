import Link from "next/link";
import { StandardEditor, type EntryInfo } from "@/components/cv-standard/StandardEditor";
import { Button } from "@/components/ui/button";
import { draftFromProfile } from "@/lib/cv-standard/draft";
import { checkCvStandard } from "@/lib/cv-standard/server";
import type { CvEntry } from "@/lib/cv-templates/content";
import { loadAllLayouts, loadCvSource } from "@/lib/cv-templates/server";
import { TEMPLATE_IDS, isTemplateId, type TemplateId } from "@/lib/cv-templates/templates";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { cvStandardStrings } from "@/lib/i18n/cv-standard";
import { cvTemplateStrings } from "@/lib/i18n/cv-templates";
import { localizedTitle } from "@/lib/i18n/titles";
import { readProfessional } from "@/lib/profile/load";
import { requireUser } from "@/lib/session";
import { toCheckView } from "./view";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("cvStandard");

const SOURCES_URL = "https://github.com/guyhazut2000/job-hunt/blob/master/docs/cv-best-practices.md";
const FROM = ["export", "tailor", "applied", "onboarding", "print"] as const;

const info = (e: CvEntry): EntryInfo => ({
  title: e.title,
  org: e.org,
  period: [e.start, e.end].filter(Boolean).join(" – "),
});

export default async function CvStandardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; template?: string; lang?: string }>;
}) {
  const sp = await searchParams;
  const from = (FROM as readonly string[]).includes(sp.from ?? "") ? sp.from! : null;
  const user = await requireUser(`/cv/standard${from ? `?from=${from}` : ""}`);
  const locale = await getLocale();
  const t = cvStandardStrings(locale);
  const tt = cvTemplateStrings(locale);
  const [profile, dbUser, source] = await Promise.all([
    db.profile.findUnique({ where: { userId: user.id } }),
    db.user.findUnique({ where: { id: user.id }, select: { name: true, email: true } }),
    loadCvSource(user.id),
  ]);

  const header = (
    <header className="rule-double flex flex-col gap-1 pb-4">
      <p className="kicker">{t.kicker}</p>
      <h1 className="font-heading text-title font-black">{t.title}</h1>
      <p className="text-muted-foreground max-w-3xl">{t.lead}</p>
      <a
        href={SOURCES_URL}
        target="_blank"
        rel="noreferrer"
        className="text-primary self-start text-sm font-semibold underline"
      >
        {t.sources}
      </a>
    </header>
  );

  if (source.empty) {
    return (
      <div className="flex flex-col gap-6" data-testid="cv-standard-empty">
        {header}
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          {t.empty}
        </p>
        <Button asChild className="self-start">
          <Link href="/profile">{t.toProfile}</Link>
        </Button>
      </div>
    );
  }

  const lang: "he" | "en" | null = sp.lang === "en" || sp.lang === "he" ? sp.lang : null;
  const opts = sp.template && isTemplateId(sp.template) ? { template: sp.template, lang } : {};
  const [check, layouts] = await Promise.all([checkCvStandard(user.id, opts), loadAllLayouts(user.id, source.content)]);
  const p = readProfessional(profile);
  const draft = draftFromProfile(p, { name: dbUser?.name ?? null, location: profile?.location ?? null });
  const templateNames = Object.fromEntries(TEMPLATE_IDS.map((id) => [id, tt.templates[id].name])) as Record<
    TemplateId,
    string
  >;

  return (
    <div className="flex flex-col gap-6" data-testid="cv-standard-page">
      {header}
      <StandardEditor
        locale={locale}
        from={from}
        email={dbUser?.email ?? null}
        initialDraft={draft}
        initialCheck={toCheckView(check)}
        baseContent={source.content}
        layouts={layouts}
        experience={source.content.experience.map(info)}
        projects={source.content.projects.map(info)}
        education={[...source.content.education, ...source.content.military].map(info)}
        yearsExperience={profile?.yearsExperience ?? null}
        templateNames={templateNames}
      />
    </div>
  );
}
