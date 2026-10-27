"use client";

import { useActionState } from "react";
import { uploadCv, type FormState } from "@/app/actions";

export function CvUpload({ label, button, detected }: { label: string; button: string; detected: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(uploadCv, undefined);
  return (
    <form action={action} className="space-y-3">
      <label className="label" htmlFor="cv">
        {label}
      </label>
      <input
        id="cv"
        name="cv"
        type="file"
        required
        className="input"
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
      />
      <button className="btn-primary" disabled={pending} type="submit">
        {pending ? "…" : button}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok !== undefined && (
        <p className="text-sm text-emerald-700">
          {detected}: <span dir="ltr">{state.ok || "—"}</span>
        </p>
      )}
    </form>
  );
}
