"use client";

import { Loader2, Wand2 } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { generateTailoredAction } from "@/app/cv/tailor/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CvLanguage } from "@/lib/cv-tailor/types";
import type { CvTailorStrings } from "@/lib/i18n/cv-tailor";

function Submit({ label, pending: pendingLabel }: { label: string; pending: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-fit rounded-full" data-testid="cvt-generate">
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Wand2 className="size-4" aria-hidden />}
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function GenerateForm({
  jobId,
  applicationId,
  detected,
  needsText,
  regenerate,
  t,
}: {
  jobId: string | null;
  applicationId: string | null;
  detected: CvLanguage;
  needsText: boolean;
  regenerate?: boolean;
  t: CvTailorStrings;
}) {
  const [state, action] = useActionState(generateTailoredAction, undefined);
  const langName = detected === "he" ? t.langHe : t.langEn;
  return (
    <form action={action} className="flex flex-col gap-3" data-testid="cvt-form">
      {jobId && <input type="hidden" name="job" value={jobId} />}
      {applicationId && <input type="hidden" name="app" value={applicationId} />}
      {needsText && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cvt-jobtext">{t.pasteLabel}</Label>
          <p className="text-muted-foreground text-xs">{t.pasteHint}</p>
          <Textarea
            id="cvt-jobtext"
            name="jobText"
            required
            rows={6}
            maxLength={12000}
            dir="auto"
            placeholder={t.pastePlaceholder}
          />
        </div>
      )}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-semibold">{t.language}</legend>
        <div className="flex flex-wrap gap-2 text-sm">
          {[
            { v: "", l: t.langAuto.replace("{lang}", langName) },
            { v: "he", l: t.langHe },
            { v: "en", l: t.langEn },
          ].map((o) => (
            <label
              key={o.v}
              className="has-[:checked]:border-primary has-[:checked]:bg-primary/5 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3"
            >
              <input type="radio" name="language" value={o.v} defaultChecked={o.v === ""} className="accent-primary" />
              {o.l}
            </label>
          ))}
        </div>
      </fieldset>
      <Submit label={regenerate ? t.regenerate : t.generate} pending={t.generating} />
      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}
    </form>
  );
}
