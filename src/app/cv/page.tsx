import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { CvPreview } from "@/components/cv-templates/CvPreview";
import { ScaledSheet } from "@/components/cv-templates/ScaledSheet";
import { demoContent } from "@/lib/cv-templates/content";
import { loadAllLayouts, loadCvSource } from "@/lib/cv-templates/server";
import { TEMPLATES, TEMPLATE_IDS } from "@/lib/cv-templates/templates";
import { getLocale } from "@/lib/i18n";
import { cvTemplateStrings } from "@/lib/i18n/cv-templates";
import { fmt } from "@/lib/i18n/learning";
import { localizedTitle } from "@/lib/i18n/titles";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("cvTemplates");

export default async function CvTemplatesGallery({ searchParams }: { searchParams: Promise<{ tailored?: string }> }) {
  const { tailored } = await searchParams;
  const user = await requireUser(tailored ? `/cv?tailored=${encodeURIComponent(tailored)}` : "/cv");
  const locale = await getLocale();
  const t = cvTemplateStrings(locale);
  const source = await loadCvSource(user.id, tailored);
  const lang = source.empty ? locale : (source.tailored?.language ?? source.written);
  const content = source.empty ? demoContent(lang) : source.content;
  const layouts = await loadAllLayouts(user.id, content);
  const q = source.tailored ? `?tailored=${source.tailored.id}` : "";
  // Recommended first, then the user's pick, then the rest in catalogue order.
  const order = [...TEMPLATE_IDS].sort(
    (a, b) =>
      Number(b === source.recommended) * 2 +
      Number(b === source.chosen) -
      (Number(a === source.recommended) * 2 + Number(a === source.chosen)),
  );

  return (
    <div className="flex flex-col gap-6" data-testid="cv-gallery">
      <header className="rule-double flex flex-col gap-1 pb-4">
        <p className="kicker">{t.kicker}</p>
        <h1 className="font-heading text-title font-black">{t.title}</h1>
        <p className="text-muted-foreground max-w-3xl">{t.lead}</p>
      </header>
      {source.tailored ? (
        <div
          className="bg-muted/50 flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
          data-testid="cv-gallery-tailored"
        >
          <span className="font-semibold">
            {fmt(t.tailoredFrom, { title: `${source.tailored.title} · ${source.tailored.company}` })}
          </span>
          <Link
            href="/cv"
            className="text-primary inline-flex min-h-10 items-center font-semibold underline underline-offset-4"
          >
            {t.tailoredClear}
          </Link>
        </div>
      ) : null}
      {source.empty ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
          data-testid="cv-gallery-empty"
        >
          <span>{t.emptyProfile}</span>
          <Link
            href="/profile"
            className="inline-flex min-h-10 items-center font-semibold underline underline-offset-4"
          >
            {t.toProfile}
          </Link>
        </div>
      ) : null}
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {order.map((id) => {
          const s = t.templates[id];
          return (
            <li
              key={id}
              data-testid={`cv-template-${id}`}
              className="bg-card flex flex-col gap-3 rounded-lg border p-3"
            >
              <Link href={`/cv/templates/${id}${q}`} className="block" tabIndex={-1} aria-hidden>
                <ScaledSheet maxHeight={330}>
                  <CvPreview content={content} layout={layouts[id]} tpl={TEMPLATES[id]} lang={lang} />
                </ScaledSheet>
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">{s.name}</h2>
                {id === source.recommended ? (
                  <span
                    className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                    data-testid="cv-recommended"
                  >
                    <Sparkles className="size-3" aria-hidden />
                    {t.recommended}
                  </span>
                ) : null}
                {id === source.chosen ? (
                  <span className="bg-muted rounded-full px-2 py-0.5 text-xs font-semibold">{t.current}</span>
                ) : null}
              </div>
              <p className="text-muted-foreground text-sm">
                <span className="text-foreground font-semibold">{t.fitsFor}</span> {s.fits}
              </p>
              <Link
                href={`/cv/templates/${id}${q}`}
                className="bg-primary text-primary-foreground mt-auto inline-flex min-h-11 items-center justify-center gap-1 rounded-md px-4 font-semibold"
              >
                {t.choose}
                <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
