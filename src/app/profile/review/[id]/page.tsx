import { notFound } from "next/navigation";
import { ProfessionalForm } from "@/components/profile/ProfessionalForm";
import { getDictionary } from "@/lib/i18n";
import { loadReview } from "@/lib/profile/review";
import { requireUser } from "@/lib/session";
import { localizedTitle } from "@/lib/i18n/titles";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("reviewCv");

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/profile/review/${id}`);
  const { t } = await getDictionary();
  const data = await loadReview(user.id, id);
  if (!data) notFound();
  const p = t.pv2;
  return (
    <div className="flex flex-col gap-6">
      <header className="rule-double flex flex-col gap-2 pb-4">
        <p className="kicker">{p.reviewSource[data.source]}</p>
        <h1 className="font-heading text-title font-black">{p.reviewTitle}</h1>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          {p.reviewHint.split("{file}")[0]}
          <bdi className="text-foreground font-mono font-semibold">{data.resume.label || data.resume.fileName}</bdi>
          {p.reviewHint.split("{file}")[1]}
        </p>
      </header>
      <ProfessionalForm
        t={p}
        initial={data.proposal}
        submitLabel={p.confirm}
        resumeId={data.resume.id}
        next="/profile?tab=profile"
      />
    </div>
  );
}
