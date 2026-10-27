"use client";

import { FileUp } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { uploadCvVersion, type ActionState } from "@/app/profile/actions";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function CvUploadForm({
  t,
  onboarding,
  showOptions = true,
}: {
  t: Dictionary["pv2"];
  onboarding?: boolean;
  showOptions?: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(uploadCvVersion, undefined);
  const [fileName, setFileName] = useState("");
  const id = useId();
  return (
    <form action={action} className="flex flex-col gap-4" aria-busy={pending}>
      {onboarding && <input type="hidden" name="onboarding" value="1" />}
      <label
        htmlFor={`${id}-file`}
        className="border-input bg-card hover:border-primary has-[:focus-visible]:ring-primary/40 flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors has-[:focus-visible]:ring-3"
      >
        <FileUp className="text-primary size-7" aria-hidden />
        <span className="font-semibold">{fileName || t.upload}</span>
        <span className="text-muted-foreground text-xs">{t.fileHint}</span>
        <input
          id={`${id}-file`}
          name="cv"
          type="file"
          required
          className="sr-only"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
        />
      </label>
      {showOptions && (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label className="label" htmlFor={`${id}-label`}>
              {t.label}
            </label>
            <input id={`${id}-label`} name="label" className="input" maxLength={80} placeholder={t.labelPh} />
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-semibold">
            <input type="checkbox" name="makeDefault" defaultChecked className="accent-primary size-5" />
            {t.makeDefault}
          </label>
        </div>
      )}
      <Button type="submit" size="lg" disabled={pending || !fileName}>
        {pending ? t.uploading : t.uploadBtn}
      </Button>
      <p role="status" aria-live="polite" className="text-sm">
        {state?.error && <span className="text-destructive">{state.error}</span>}
      </p>
    </form>
  );
}
