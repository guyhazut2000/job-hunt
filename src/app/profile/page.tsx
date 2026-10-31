import type { Document } from "@prisma/client";
import { ArrowLeft, FolderOpen, LayoutTemplate, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { DocumentsManager } from "@/components/documents/DocumentsManager";
import { DocumentUploader } from "@/components/documents/DocumentUploader";
import { fill } from "@/components/documents/fmt";
import type { DocumentRow } from "@/components/documents/types";
import { CompletenessMeter } from "@/components/profile/CompletenessMeter";
import { CvList } from "@/components/profile/CvList";
import { CvUploadForm } from "@/components/profile/CvUploadForm";
import { TailoredCvList } from "@/components/cv-tailor/TailoredCvList";
import { PreferencesForm } from "@/components/profile/PreferencesForm";
import { ProfessionalForm } from "@/components/profile/ProfessionalForm";
import { Progress } from "@/components/ui/progress";
import { db } from "@/lib/db";
import { USER_QUOTA_BYTES } from "@/lib/documents/constants";
import { storageDriver } from "@/lib/documents/storage";
import { expiryStatus, formatBytes } from "@/lib/documents/validate";
import { getDictionary } from "@/lib/i18n";
import { cvTemplateStrings } from "@/lib/i18n/cv-templates";
import { documentStrings } from "@/lib/i18n/documents";
import { GRAPH } from "@/lib/learning/graph";
import { computeCompleteness } from "@/lib/profile/completeness";
import { readPreferences, readProfessional } from "@/lib/profile/load";
import { PROFILE_SECTIONS, profileHref, resolveProfileView } from "@/lib/profile/tabs";
import { requireUser } from "@/lib/session";
import { localizedTitle } from "@/lib/i18n/titles";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("profile");

const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; section?: string }>;
}) {
  const user = await requireUser("/profile");
  const { t, locale } = await getDictionary();
  const view = resolveProfileView(await searchParams);
  const ds = documentStrings(locale);
  const [profile, resumes, docs] = await Promise.all([
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
    db.document.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      omit: { storageKey: true, sha256: true, userId: true },
    }),
  ]);
  const completeness = computeCompleteness({ hasCv: resumes.length > 0, profile });
  const p = t.pv2;
  const docCount = resumes.length + docs.length;

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

      {/* Main split: profile vs. CVs & documents. Plain links, so the tab lives in the URL. */}
      <nav aria-label={p.mainTabsLabel} className="border-b" data-profile-tabs>
        <ul className="-mb-px flex gap-1">
          {(
            [
              ["profile", UserRound, null],
              ["documents", FolderOpen, docCount],
            ] as const
          ).map(([k, Icon, count]) => (
            <li key={k} className="flex-1 sm:flex-none">
              <Link
                href={profileHref(k)}
                aria-current={view.tab === k ? "page" : undefined}
                className="text-muted-foreground hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:text-foreground flex min-h-12 items-center justify-center gap-2 border-b-2 border-transparent px-4 text-base font-bold whitespace-nowrap"
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {p.mainTabs[k]}
                {count ? <span className="text-muted-foreground font-mono text-xs font-medium">{count}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {view.tab === "profile" ? (
        <div className="grid gap-8 lg:grid-cols-[1fr_18rem] lg:items-start">
          <div className="flex min-w-0 flex-col gap-6">
            <p className="text-muted-foreground -mt-2 text-sm">{p.profileLead}</p>
            <nav aria-label={p.mainTabs.profile} className="bg-muted rounded-lg p-1">
              <ul className="grid grid-cols-2 gap-1">
                {PROFILE_SECTIONS.map((k) => (
                  <li key={k}>
                    <Link
                      href={profileHref("profile", k)}
                      aria-current={view.section === k ? "page" : undefined}
                      className="text-muted-foreground hover:text-foreground aria-[current=page]:bg-card aria-[current=page]:text-foreground flex min-h-11 items-center justify-center rounded-md px-2 text-center text-sm leading-tight font-semibold aria-[current=page]:shadow-sm"
                    >
                      {p.tabs[k]}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {view.section === "pro" ? (
              <ProfessionalForm key={profile?.updatedAt.toISOString()} t={p} initial={readProfessional(profile)} />
            ) : (
              <PreferencesForm
                key={profile?.updatedAt.toISOString()}
                t={p}
                roles={t.roles}
                seniority={t.seniority}
                workMode={t.workMode}
                initial={readPreferences(profile)}
              />
            )}
          </div>
          <aside className="order-first lg:sticky lg:top-24 lg:order-none">
            <CompletenessMeter t={p} result={completeness} />
          </aside>
        </div>
      ) : (
        <DocumentsTab
          userId={user.id}
          p={p}
          ds={ds}
          dateLocale={t.dateLocale}
          resumes={resumes}
          docs={docs}
          locale={locale}
        />
      )}
    </div>
  );
}

type Dict = Awaited<ReturnType<typeof getDictionary>>["t"];
type ResumeRow = {
  id: string;
  label: string | null;
  fileName: string;
  sizeBytes: number;
  isPrimary: boolean;
  createdAt: Date;
  appliedAt: Date | null;
  skills: string[];
  file: { id: string } | null;
};
type DocRow = Omit<Document, "storageKey" | "sha256" | "userId">;

function DocumentsTab({
  userId,
  p,
  ds,
  dateLocale,
  resumes,
  docs,
  locale,
}: {
  locale: "he" | "en";
  userId: string;
  p: Dict["pv2"];
  ds: ReturnType<typeof documentStrings>;
  dateLocale: string;
  resumes: ResumeRow[];
  docs: DocRow[];
}) {
  const now = new Date();
  const rows: DocumentRow[] = docs.map((d) => ({
    id: d.id,
    type: d.type,
    title: d.title,
    issuer: d.issuer,
    issueDate: ymd(d.issueDate),
    expiryDate: ymd(d.expiryDate),
    language: d.language,
    tags: d.tags,
    notes: d.notes,
    skills: d.skills,
    fileName: d.fileName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    version: d.version,
    isDefault: d.isDefault,
    createdAt: d.createdAt.toISOString(),
    expiry: expiryStatus(d.expiryDate, now),
    daysToExpiry: d.expiryDate ? Math.max(0, Math.ceil((d.expiryDate.getTime() - now.getTime()) / 86_400_000)) : null,
  }));
  const ct = cvTemplateStrings(locale);
  const used = docs.reduce((s, d) => s + d.sizeBytes, 0);
  const skills = GRAPH.nodes.map((n) => ({ id: n.id, label: n.label })).sort((a, b) => a.label.localeCompare(b.label));
  const mode = storageDriver();

  return (
    <div className="flex flex-col gap-10">
      <p className="text-muted-foreground -mt-2 text-sm">{p.documentsLead}</p>

      <section
        className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
        data-testid="cv-templates-card"
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <LayoutTemplate className="text-primary mt-1 size-5 shrink-0" aria-hidden />
          <div>
            <h2 className="font-heading text-lg font-bold">{ct.docsCard.title}</h2>
            <p className="text-muted-foreground text-sm">{ct.docsCard.body}</p>
          </div>
        </div>
        <Link
          href="/cv"
          className="bg-primary text-primary-foreground inline-flex min-h-11 items-center rounded-md px-4 text-sm font-semibold"
        >
          {ct.docsCard.cta}
        </Link>
      </section>

      {/* CVs: parsed into the profile, so they keep their own upload flow. */}
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
        <section className="flex min-w-0 flex-col gap-3" aria-labelledby="cvs-h" data-cv-section>
          <h2 id="cvs-h" className="font-heading text-xl font-bold">
            {p.cvs}{" "}
            {resumes.length > 0 && <span className="text-muted-foreground font-mono text-sm">{resumes.length}</span>}
          </h2>
          <p className="text-muted-foreground text-sm">{p.cvsHint}</p>
          <CvList t={p} dateLocale={dateLocale} rows={resumes.map(({ file, ...r }) => ({ ...r, hasFile: !!file }))} />
        </section>
        <section className="form-section" aria-labelledby="upload-cv-h">
          <h2 id="upload-cv-h" className="font-heading text-xl font-bold">
            {p.upload}
          </h2>
          <CvUploadForm t={p} showOptions={resumes.length > 0} />
          <p className="text-muted-foreground text-xs">{p.storageNote}</p>
        </section>
      </div>

      {/* CV versions tailored to specific jobs (docs/cv-tailor.md). */}
      <div className="border-rule border-t-2 pt-8">
        <TailoredCvList userId={userId} locale={locale} />
      </div>

      {/* Everything else: the document vault. */}
      <div className="border-rule grid gap-8 border-t-2 pt-8 lg:grid-cols-[1fr_20rem] lg:items-start" data-docs-section>
        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <h2 className="font-heading text-xl font-bold">
              {p.otherDocs}{" "}
              {docs.length > 0 && <span className="text-muted-foreground font-mono text-sm">{docs.length}</span>}
            </h2>
            <p className="text-muted-foreground text-sm">{p.otherDocsHint}</p>
          </div>
          <DocumentsManager
            t={ds}
            docs={rows}
            cvs={[]}
            skills={skills}
            mode={mode}
            userId={userId}
            dateLocale={dateLocale}
          />
        </div>
        <section className="form-section" aria-labelledby="upload-h">
          <h2 id="upload-h" className="font-heading text-xl font-bold">
            {ds.uploadTitle}
          </h2>
          <DocumentUploader t={ds} mode={mode} userId={userId} />
          <div className="flex flex-col gap-1.5">
            <Progress value={(used / USER_QUOTA_BYTES) * 100} aria-label={ds.usage} />
            <p className="text-muted-foreground font-mono text-xs">
              {fill(ds.usage, { used: formatBytes(used || 0), limit: formatBytes(USER_QUOTA_BYTES) })}
            </p>
          </div>
          <p className="text-muted-foreground flex gap-2 text-xs">
            <ShieldCheck className="size-4 shrink-0" aria-hidden />
            {ds.privacy}
          </p>
        </section>
      </div>
    </div>
  );
}
