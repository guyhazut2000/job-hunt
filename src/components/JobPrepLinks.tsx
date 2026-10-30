import { FileText, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/dictionaries";
import { cvTailorStrings } from "@/lib/i18n/cv-tailor";
import { interviewStrings } from "@/lib/i18n/interview";

/** Job page: prepare for this job (tailored CV, practice interview). Signed-in users only. */
export function JobPrepLinks({ jobId, locale }: { jobId: string; locale: Locale }) {
  const cv = cvTailorStrings(locale);
  const iv = interviewStrings(locale);
  return (
    <div className="flex flex-wrap gap-2" data-testid="job-prep-links">
      <Button asChild variant="outline" className="flex-1 rounded-full">
        <Link href={`/cv/tailor?job=${jobId}`} data-testid="job-tailor-cv">
          <FileText className="size-4" aria-hidden />
          {cv.jobCta}
        </Link>
      </Button>
      <Button asChild variant="outline" className="flex-1 rounded-full">
        <Link href={`/interview?job=${jobId}`} data-testid="job-interview-sim">
          <MessagesSquare className="size-4" aria-hidden />
          {iv.practiceCta}
        </Link>
      </Button>
    </div>
  );
}
