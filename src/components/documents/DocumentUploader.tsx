"use client";

import { CheckCircle2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { finalizeDocument } from "@/app/documents/actions";
import { Progress } from "@/components/ui/progress";
import { ACCEPT_ATTR, UPLOAD_TYPES, type DocumentTypeKey } from "@/lib/documents/constants";
import { precheckUpload } from "@/lib/documents/validate";
import type { DocumentStrings } from "@/lib/i18n/documents";
import { UploadFailure, uploadToStorage, type StorageMode } from "./upload-client";

type Phase =
  { k: "idle" } | { k: "uploading"; pct: number } | { k: "verifying" } | { k: "done" } | { k: "error"; msg: string };

export function errorText(t: DocumentStrings, code: string): string {
  return (t.errors as Record<string, string>)[code] ?? t.errors.generic;
}

export function DocumentUploader({
  t,
  mode,
  userId,
  defaultType = "TRANSCRIPT",
}: {
  t: DocumentStrings;
  mode: StorageMode;
  userId: string;
  defaultType?: DocumentTypeKey;
}) {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<DocumentTypeKey>(defaultType);
  const [drag, setDrag] = useState(false);
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const busy = phase.k === "uploading" || phase.k === "verifying";

  async function handle(file: File | undefined) {
    if (!file || busy) return;
    const pre = precheckUpload(file);
    if (pre) return setPhase({ k: "error", msg: errorText(t, pre) });
    setPhase({ k: "uploading", pct: 0 });
    try {
      const key = await uploadToStorage(file, {
        mode,
        userId,
        onProgress: (pct) => setPhase({ k: "uploading", pct }),
      });
      setPhase({ k: "verifying" });
      const res = await finalizeDocument({ key, fileName: file.name, type });
      if (!res.ok) return setPhase({ k: "error", msg: errorText(t, res.error) });
      setPhase({ k: "done" });
      router.refresh();
    } catch (e) {
      setPhase({ k: "error", msg: errorText(t, e instanceof UploadFailure ? e.message : "generic") });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (!mode) return <p className="text-muted-foreground bg-muted rounded-md p-3 text-sm">{t.storageOff}</p>;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="label" htmlFor={`${inputId}-type`}>
          {t.typeLabel}
        </label>
        <select
          id={`${inputId}-type`}
          className="select-native"
          value={type}
          onChange={(e) => setType(e.target.value as DocumentTypeKey)}
          disabled={busy}
        >
          {UPLOAD_TYPES.map((k) => (
            <option key={k} value={k}>
              {t.types[k]}
            </option>
          ))}
        </select>
      </div>
      <label
        htmlFor={inputId}
        data-drag={drag || undefined}
        aria-busy={busy}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void handle(e.dataTransfer.files[0]);
        }}
        className="border-input bg-card hover:bg-muted data-[drag]:border-primary data-[drag]:bg-primary/5 flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors aria-busy:cursor-wait aria-busy:opacity-70"
      >
        <UploadCloud className="text-muted-foreground size-8" aria-hidden />
        <span className="font-semibold">{drag ? t.dropActive : t.dropHere}</span>
        <span className="text-muted-foreground text-xs">{t.dropHint}</span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPT_ATTR}
          className="sr-only"
          disabled={busy}
          onChange={(e) => void handle(e.target.files?.[0])}
        />
      </label>
      <div role="status" aria-live="polite" className="min-h-5 text-sm">
        {phase.k === "uploading" && (
          <div className="flex flex-col gap-1.5">
            <span>{t.uploading}</span>
            <Progress value={phase.pct} />
          </div>
        )}
        {phase.k === "verifying" && <span>{t.verifying}</span>}
        {phase.k === "done" && (
          <span className="text-fit inline-flex items-center gap-1.5 font-semibold">
            <CheckCircle2 className="size-4" aria-hidden />
            {t.uploaded}
          </span>
        )}
        {phase.k === "error" && <span className="text-destructive font-semibold">{phase.msg}</span>}
      </div>
    </div>
  );
}
