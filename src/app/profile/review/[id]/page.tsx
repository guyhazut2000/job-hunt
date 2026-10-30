import { notFound } from "next/navigation";
import { ProfessionalForm } from "@/components/profile/ProfessionalForm";
import { getDictionary } from "@/lib/i18n";
import { loadReview } from "@/lib/profile/review";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review CV" };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { t } = await getDictionary();
  const { id } = await params;
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
