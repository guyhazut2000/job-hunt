import { auth } from "@/auth";
import { demoContent } from "@/lib/cv-templates/content";
import { renderCvDocx } from "@/lib/cv-templates/docx";
import { renderCvPdf } from "@/lib/cv-templates/pdf";
import { loadCvSource, loadLayout } from "@/lib/cv-templates/server";
import { TEMPLATES, isTemplateId } from "@/lib/cv-templates/templates";
import { translateContent } from "@/lib/cv-templates/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// react-pdf + one translation call; typical export is < 3 s.
export const maxDuration = 60;

const asciiName = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40) || "cv";

/**
 * GET /api/cv/export?template=hitech&lang=he&format=pdf|docx[&tailored=<id>][&demo=1]
 * Owner-only. Content from the profile (or a tailored CV), layout from CvLayout.
 * Response headers: X-Cv-Translation = translated | none | off | limited | error.
 */
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const template = url.searchParams.get("template");
  const lang = url.searchParams.get("lang") === "en" ? "en" : "he";
  const format = url.searchParams.get("format") === "docx" ? "docx" : "pdf";
  if (!isTemplateId(template)) return new Response("Unknown template", { status: 400 });
  const tpl = TEMPLATES[template];

  const source = await loadCvSource(userId, url.searchParams.get("tailored"));
  const demo = url.searchParams.get("demo") === "1" || source.empty;
  let content = demo ? demoContent(lang) : source.content;
  let translation = "none";
  if (!demo && source.written !== lang) {
    const r = await translateContent(content, lang, userId);
    content = r.content;
    translation = r.status;
  }
  const layout = await loadLayout(userId, template, content);
  const buf =
    format === "pdf"
      ? await renderCvPdf({ content, layout, tpl, lang })
      : await renderCvDocx({ content, layout, tpl, lang });

  const base = `${asciiName(content.name)}-${template}-${lang}`;
  const display = `${content.name || "CV"} – ${template} (${lang}).${format}`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${base}.${format}"; filename*=UTF-8''${encodeURIComponent(display)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Cv-Translation": translation,
    },
  });
}
