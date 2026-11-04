/** Server side of the ATS check (#115): render the real PDF export, read its text back, evaluate. */
import { fitCvPdf } from "@/lib/cv-standard/fit";
import { extractText } from "@/lib/cv/parse";
import { loadCvSource, loadLayout } from "@/lib/cv-templates/server";
import { blockTitle, resolveBlocks } from "@/lib/cv-templates/resolve";
import { isBuiltin } from "@/lib/cv-templates/sections";
import { TEMPLATES, isTemplateId, type TemplateId } from "@/lib/cv-templates/templates";
import { db } from "@/lib/db";
import { evaluateAts, type AtsJob, type AtsReport } from "./check";

export interface AtsJobOption {
  id: string;
  title: string;
  company: string;
  status: string;
}

export interface AtsRun {
  empty: boolean;
  report: AtsReport | null;
  template: TemplateId;
  columns: 1 | 2;
  lang: "he" | "en";
  /** Rendering / extraction failed; parsing rules are "pending". */
  renderError: boolean;
  job: { title: string; company: string | null } | null;
}

const SENIOR = new Set(["SENIOR", "LEAD", "MANAGER"]);

/** Saved / applied jobs the user can check against (most recent first, capped). */
export async function atsJobOptions(userId: string): Promise<AtsJobOption[]> {
  const apps = await db.application.findMany({
    where: { userId, jobId: { not: null }, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { jobId: true, title: true, company: true, status: true },
  });
  return apps.map((a) => ({ id: a.jobId!, title: a.title, company: a.company, status: a.status }));
}

export async function loadAtsJob(userId: string, jobId: string): Promise<(AtsJob & { company: string }) | null> {
  // Only jobs the user tracks — never an arbitrary id.
  const app = await db.application.findFirst({
    where: { userId, jobId },
    select: {
      job: { select: { title: true, techStack: true, description: true, company: { select: { name: true } } } },
    },
  });
  const j = app?.job;
  return j ? { title: j.title, tech: j.techStack, text: j.description, company: j.company.name } : null;
}

export async function runAts(
  userId: string,
  opts: { template?: string | null; job?: (AtsJob & { company?: string | null }) | null } = {},
): Promise<AtsRun> {
  const [source, profile] = await Promise.all([
    loadCvSource(userId),
    db.profile.findUnique({ where: { userId }, select: { seniority: true, desiredRole: true } }),
  ]);
  const template: TemplateId = isTemplateId(opts.template) ? opts.template : (source.chosen ?? source.recommended);
  const tpl = TEMPLATES[template];
  const lang = source.written;
  const job = opts.job ?? null;
  const base = {
    template,
    columns: tpl.columns,
    lang,
    job: job ? { title: job.title, company: job.company ?? null } : null,
  };
  if (source.empty) return { ...base, empty: true, report: null, renderError: false };

  const layout = await loadLayout(userId, template, source.content);
  const blocks = resolveBlocks(source.content, layout, tpl, lang);
  const customHeadings = layout
    .filter((e) => e.visible && (!isBuiltin(e.id) || e.titles[lang]?.trim()))
    .map((e) => blockTitle(source.content, e, tpl, lang));

  let extracted: string | null = null;
  let pdfBytes: number | null = null;
  let renderError = false;
  try {
    const fit = await fitCvPdf({ content: source.content, layout, tpl, lang });
    pdfBytes = fit.buffer.byteLength;
    extracted = await extractText(Buffer.from(fit.buffer), "application/pdf");
  } catch (e) {
    renderError = true;
    console.error("[ats] render/extract failed:", e instanceof Error ? e.message : String(e));
  }

  const senior =
    (profile?.seniority ? SENIOR.has(profile.seniority) : false) ||
    /senior|lead|staff|principal|בכיר|ראש צוות/i.test(profile?.desiredRole ?? "");
  const report = evaluateAts({
    content: source.content,
    columns: tpl.columns,
    headings: blocks.map((b) => b.title),
    sections: blocks.map((b) => b.id),
    customHeadings,
    extracted,
    pdfBytes,
    job,
    senior,
  });
  return { ...base, empty: false, report, renderError };
}
