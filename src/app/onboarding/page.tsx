import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { skipOnboarding } from "@/app/profile/actions";
import { CvUploadForm } from "@/components/profile/CvUploadForm";
import { PreferencesForm } from "@/components/profile/PreferencesForm";
import { ProfessionalForm } from "@/components/profile/ProfessionalForm";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { readPreferences, readProfessional } from "@/lib/profile/load";
import { requireUser } from "@/lib/session";
import { loadReview } from "@/lib/profile/review";

export const dynamic = "force-dynamic";
export const metadata = { title: "Get started" };

function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="progress">
      {steps.map((s, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "todo";
        return (
          <li key={s} aria-current={state === "current" ? "step" : undefined} className="flex flex-col gap-2">
            <span
              aria-hidden
              className={`h-1.5 rounded-full ${state === "todo" ? "bg-muted" : state === "done" ? "bg-foreground" : "bg-primary"}`}
            />
            <span
              className={`flex items-baseline gap-1.5 text-xs sm:text-sm ${state === "todo" ? "text-muted-foreground" : "font-semibold"}`}
            >
              <span className="font-mono">{String(n).padStart(2, "0")}</span>
              {s}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; cv?: string }>;
}) {
  const user = await requireUser();
  const { t } = await getDictionary();
  const p = t.pv2;
  const o = p.onboarding;
  const sp = await searchParams;
  const step = Math.min(3, Math.max(1, Number(sp.step) || 1));
  const profile = await db.profile.findUnique({ where: { userId: user.id } });

  let review: Awaited<ReturnType<typeof loadReview>> = null;
  if (step === 2) {
    const cvId =
      sp.cv ??
      (await db.resume.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true } }))
        ?.id;
    if (cvId) review = await loadReview(user.id, cvId);
  }

  const back = (to: number) => (
    <Button asChild variant="ghost" size="lg">
      <Link href={`/onboarding?step=${to}`}>
        <ArrowRight data-icon="inline-start" className="ltr:rotate-180" />
        {o.back}
      </Link>
    </Button>
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <p className="kicker">{o.kicker}</p>
          <form action={skipOnboarding}>
            <Button type="submit" variant="link" className="h-11 px-0">
              {o.skip}
            </Button>
          </form>
        </div>
        <h1 className="font-heading text-title font-black">{o.title}</h1>
        <Stepper steps={o.steps} current={step} />
      </header>

      {step === 1 && (
        <section className="flex flex-col gap-4" aria-labelledby="s1">
          <h2 id="s1" className="font-heading text-2xl font-bold">
            {o.uploadTitle}
          </h2>
          <p className="text-muted-foreground text-sm">{o.uploadHint}</p>
          <CvUploadForm t={p} onboarding showOptions={false} />
          <Link
            href="/onboarding?step=2"
            className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center self-center text-sm underline underline-offset-4"
          >
            {o.skipStep}
          </Link>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-4" aria-labelledby="s2">
          <h2 id="s2" className="font-heading text-2xl font-bold">
            {o.reviewTitle}
          </h2>
          {review && (
            <p className="text-muted-foreground text-sm">
              {p.reviewSource[review.source]} ·{" "}
              <bdi className="font-mono">{review.resume.label || review.resume.fileName}</bdi>
            </p>
          )}
          <ProfessionalForm
            t={p}
            initial={review ? review.proposal : readProfessional(profile)}
            resumeId={review?.resume.id}
            submitLabel={p.confirm}
            next="/onboarding?step=3"
          />
          <div className="flex">{back(1)}</div>
        </section>
      )}

      {step === 3 && (
        <section className="flex flex-col gap-4" aria-labelledby="s3">
          <h2 id="s3" className="font-heading text-2xl font-bold">
            {o.prefsTitle}
          </h2>
          <PreferencesForm
            t={p}
            roles={t.roles}
            seniority={t.seniority}
            workMode={t.workMode}
            initial={readPreferences(profile)}
            onboarding={{ finish: o.finish, back: back(2) }}
          />
        </section>
      )}
    </div>
  );
}
