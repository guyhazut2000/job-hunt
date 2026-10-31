import { notFound } from "next/navigation";
import { TemplateEditor } from "@/components/cv-templates/TemplateEditor";
import { aiEnabled } from "@/lib/ai";
import { demoContent } from "@/lib/cv-templates/content";
import { loadCvSource, loadLayout } from "@/lib/cv-templates/server";
import { TEMPLATES, isTemplateId } from "@/lib/cv-templates/templates";
import { getLocale } from "@/lib/i18n";
import { cvTemplateStrings } from "@/lib/i18n/cv-templates";
import { localizedTitle } from "@/lib/i18n/titles";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("cvTemplates");

export default async function CvTemplateEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tailored?: string }>;
}) {
  const [{ id }, { tailored }] = await Promise.all([params, searchParams]);
  if (!isTemplateId(id)) notFound();
  const user = await requireUser(`/cv/templates/${id}${tailored ? `?tailored=${encodeURIComponent(tailored)}` : ""}`);
  const locale = await getLocale();
  const source = await loadCvSource(user.id, tailored);
  const written = source.empty ? locale : (source.tailored?.language ?? source.written);
  const content = source.empty ? demoContent(written) : source.content;
  const layout = await loadLayout(user.id, id, content);
  return (
    <TemplateEditor
      t={cvTemplateStrings(locale)}
      template={id}
      tpl={TEMPLATES[id]}
      content={content}
      demo={source.empty}
      written={written}
      initialLayout={layout}
      tailored={source.tailored}
      isDefault={source.chosen === id}
      canTranslate={aiEnabled()}
    />
  );
}
