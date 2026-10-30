import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CvSheet } from "@/components/cv-tailor/CvSheet";
import { PrintButton } from "@/components/problem-solving/PrintButton";
import type { CvDoc, CvLanguage } from "@/lib/cv-tailor/types";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { cvTailorStrings } from "@/lib/i18n/cv-tailor";
import { requireUser } from "@/lib/session";
import { localizedTitle } from "@/lib/i18n/titles";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("cv");

// Print / "Save as PDF": hide the site chrome, plain white A4, keep roles together.
const PRINT_CSS = `@media print {
  header, footer, nav, [data-print-hide], [data-bottom-nav], [data-testid="chat-fab"], [role="dialog"] { display: none !important; }
  body { background: #fff !important; }
  main { padding: 0 !important; margin: 0 !important; max-width: none !important; }
  .cv-sheet { border: 0 !important; padding: 0 !important; box-shadow: none !important; font-size: 10.5pt; }
  .cv-role { break-inside: avoid; }
  @page { size: A4; margin: 14mm; }
}`;

export default async function PrintTailoredCv({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/cv/tailor/${id}/print`);
  const t = cvTailorStrings(await getLocale());
  const row = await db.tailoredCv.findFirst({
    where: { id, userId: user.id },
    select: { id: true, content: true, language: true, title: true, company: true },
  });
  if (!row) notFound();
  const language = (row.language === "en" ? "en" : "he") as CvLanguage;
  return (
    <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-4">
      <style>{PRINT_CSS}</style>
      <div data-print-hide className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/cv/tailor/${row.id}`}
          className="text-primary inline-flex min-h-11 items-center gap-1 text-sm font-semibold"
        >
          <ArrowLeft className="size-4 rotate-180 ltr:rotate-0" aria-hidden />
          {t.backToEditor}
        </Link>
        <div className="flex flex-col items-end gap-1">
          <PrintButton label={t.print} />
          <p className="text-muted-foreground text-xs">{t.printHint}</p>
        </div>
      </div>
      <CvSheet doc={row.content as unknown as CvDoc} language={language} />
    </div>
  );
}
