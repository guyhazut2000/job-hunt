import { ArrowRight, FileUp, PencilLine } from "lucide-react";
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
import { localizedTitle } from "@/lib/i18n/titles";
import { finishOnboarding } from "@/app/onboarding/actions";
import { TemplatePicker } from "@/components/onboarding/TemplatePicker";
import { demoContent } from "@/lib/cv-templates/content";
import { loadAllLayouts, loadCvSource } from "@/lib/cv-templates/server";
import { TEMPLATE_IDS } from "@/lib/cv-templates/templates";
import { cvTemplateStrings } from "@/lib/i18n/cv-templates";
import { advanceStored, currentStep } from "@/lib/profile/onboarding";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("onboarding");

function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      aria-label="progress"
    >
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
  searchParams: Promise<{ step?: string; cv?: string; manual?: string }>;
}) {
  const user = await requireUser("/onboarding");
  const { t, locale } = await getDictionary();
  const p = t.pv2;
  const o = p.onboarding;
  const sp = await searchParams;
  const profile = await db.profile.findUnique({ where: { userId: user.id } });
  // Resumable: without ?step= we continue at the furthest step reached; the stored step only moves forward.
  const step = currentStep(sp.step, profile?.onboardingStep);
  const resumed = !sp.step && (profile?.onboardingStep ?? 0) > 1;
  const stored = advanceStored(profile?.onboardingStep, step);
  if (stored)
    await db.profile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, skills: [], onboardingStep: stored },
      update: { onboardingStep: stored },
    });

  let picker: React.ReactNode = null;
  if (step === 4) {
    const ct = cvTemplateStrings(locale);
    const source = await loadCvSource(user.id);
    const lang = source.empty ? locale : source.written;
    const content = source.empty ? demoContent(lang) : source.content;
    const layouts = await loadAllLayouts(user.id, content);
    const order = [source.recommended, ...TEMPLATE_IDS.filter((x) => x !== source.recommended)];
    picker = (
      <TemplatePicker
        order={order}
        recommended={source.recommended}
        initial={source.chosen ?? source.recommended}
        content={content}
        layouts={layouts}
        lang={lang}
        t={ct}
        label={o.templatePickLabel}
        customize={o.templateCustomize}
      />
    );
  }

  let review: Awaited<ReturnType<typeof loadReview>> = null;
  if (step === 2 && !sp.manual) {
    const cvId =
      sp.cv ??
      (await db.resume.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true } }))
        ?.id;
    if (cvId) review = await loadReview(user.id, cvId);
  }

  const back = (to: number) => (
    <Button asChild variant="ghost" size="lg">
      <Link href={`/onboarding?step=${to}${to === 2 ? "&manual=1" : ""}`}>
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

      {resumed && (
        <p className="bg-muted/60 rounded-md px-3 py-2 text-sm" role="status" data-testid="onb-resumed">
          {o.resumed}
        </p>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-4" aria-labelledby="s1">
          <h2 id="s1" className="font-heading text-2xl font-bold">
            {o.startTitle}
          </h2>
          <p className="text-muted-foreground text-sm">{o.startHint}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-card flex flex-col gap-3 rounded-lg border p-4" data-testid="onb-option-upload">
              <h3 className="flex items-center gap-2 text-lg font-bold">
                <FileUp className="size-5" aria-hidden />
                {o.optionUpload}
              </h3>
              <p className="text-muted-foreground text-sm">{o.optionUploadBody}</p>
              <CvUploadForm t={p} onboarding showOptions={false} />
            </div>
            <div className="bg-card flex flex-col gap-3 rounded-lg border p-4" data-testid="onb-option-manual">
              <h3 className="flex items-center gap-2 text-lg font-bold">
                <PencilLine className="size-5" aria-hidden />
                {o.optionManual}
              </h3>
              <p className="text-muted-foreground text-sm">{o.optionManualBody}</p>
              <Button asChild variant="outline" size="lg" className="mt-auto">
                <Link href="/onboarding?step=2&manual=1" data-testid="onb-manual">
                  {o.optionManualCta}
                </Link>
              </Button>
            </div>
          </div>
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

      {step === 4 && (
        <section className="flex flex-col gap-4" aria-labelledby="s4">
          <h2 id="s4" className="font-heading text-2xl font-bold">
            {o.templateTitle}
          </h2>
          <p className="text-muted-foreground text-sm">{o.templateHint}</p>
          <form action={finishOnboarding} className="flex flex-col gap-5">
            {picker}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {back(3)}
              <Button type="submit" size="lg" data-testid="onb-finish">
                {o.templateFinish}
              </Button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
