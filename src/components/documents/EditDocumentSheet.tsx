"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { updateDocument } from "@/app/documents/actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { UPLOAD_TYPES, type DocumentTypeKey } from "@/lib/documents/constants";
import type { DocumentStrings } from "@/lib/i18n/documents";
import { errorText } from "./DocumentUploader";
import { fill } from "./fmt";
import type { DocumentRow, SkillOption } from "./types";

export function EditDocumentSheet({
  t,
  doc,
  skills,
  onClose,
}: {
  t: DocumentStrings;
  doc: DocumentRow | null;
  skills: SkillOption[];
  onClose: () => void;
}) {
  return (
    <Sheet open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-heading text-xl">{t.editTitle}</SheetTitle>
          {doc && (
            <SheetDescription className="font-mono text-xs break-all">
              <bdi>{doc.fileName}</bdi>
            </SheetDescription>
          )}
        </SheetHeader>
        {doc && <EditForm key={doc.id} t={t} doc={doc} skills={skills} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function EditForm({
  t,
  doc,
  skills,
  onClose,
}: {
  t: DocumentStrings;
  doc: DocumentRow;
  skills: SkillOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [type, setType] = useState<DocumentTypeKey>(doc.type);
  const [picked, setPicked] = useState<string[]>(doc.skills);
  const [q, setQ] = useState("");
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const byId = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return skills.filter((s) => !picked.includes(s.id) && s.label.toLowerCase().includes(n)).slice(0, 8);
  }, [q, skills, picked]);
  const f = t.fields;

  function submit(form: FormData) {
    setError(null);
    start(async () => {
      const res = await updateDocument(doc.id, {
        type,
        title: String(form.get("title") ?? ""),
        issuer: String(form.get("issuer") ?? ""),
        issueDate: String(form.get("issueDate") ?? ""),
        expiryDate: String(form.get("expiryDate") ?? ""),
        language: String(form.get("language") ?? ""),
        tags: String(form.get("tags") ?? ""),
        notes: String(form.get("notes") ?? ""),
        skills: type === "CERTIFICATION" ? picked : [],
      });
      if (!res.ok) return setError({ text: errorText(t, res.error), field: res.field });
      router.refresh();
      if (res.skillsAdded.length) setNotice(fill(t.skillsAdded, { skills: res.skillsAdded.join(", ") }));
      else onClose();
    });
  }

  if (notice)
    return (
      <div className="flex flex-col gap-4 px-4 pb-6">
        <p role="status" className="bg-fit-soft text-fit rounded-md p-3 text-sm font-semibold">
          {notice}
        </p>
        <Button onClick={onClose}>{t.saved}</Button>
      </div>
    );

  const invalid = (name: string) => (error?.field === name ? true : undefined);

  return (
    <form action={submit} className="flex flex-col gap-4 px-4 pb-6">
      <div>
        <label className="label" htmlFor="doc-type">
          {t.typeLabel}
        </label>
        <select
          id="doc-type"
          className="select-native"
          value={type}
          onChange={(e) => setType(e.target.value as DocumentTypeKey)}
        >
          {UPLOAD_TYPES.map((k) => (
            <option key={k} value={k}>
              {t.types[k]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="doc-title">
          {f.title}
        </label>
        <input
          id="doc-title"
          name="title"
          className="input"
          defaultValue={doc.title}
          required
          maxLength={120}
          dir="auto"
          aria-invalid={invalid("title")}
        />
      </div>
      <div>
        <label className="label" htmlFor="doc-issuer">
          {f.issuer}
        </label>
        <input
          id="doc-issuer"
          name="issuer"
          className="input"
          defaultValue={doc.issuer ?? ""}
          maxLength={120}
          placeholder={f.issuerHint}
          dir="auto"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="doc-issue">
            {f.issueDate}
          </label>
          <input id="doc-issue" name="issueDate" type="date" className="input" defaultValue={doc.issueDate ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="doc-expiry">
            {f.expiryDate}
          </label>
          <input
            id="doc-expiry"
            name="expiryDate"
            type="date"
            className="input"
            defaultValue={doc.expiryDate ?? ""}
            aria-invalid={invalid("expiryDate")}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="doc-lang">
          {f.language}
        </label>
        <select id="doc-lang" name="language" className="select-native" defaultValue={doc.language ?? ""}>
          <option value="">{f.langNone}</option>
          <option value="he">{f.langHe}</option>
          <option value="en">{f.langEn}</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="doc-tags">
          {f.tags}
        </label>
        <input
          id="doc-tags"
          name="tags"
          className="input"
          defaultValue={doc.tags.join(", ")}
          placeholder={f.tagsHint}
          dir="auto"
        />
      </div>
      {type === "CERTIFICATION" && (
        <fieldset className="flex flex-col gap-2">
          <legend className="label">{f.skills}</legend>
          <p className="text-muted-foreground -mt-1 text-xs">{f.skillsHint}</p>
          {picked.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" dir="ltr">
              {picked.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    className="chip bg-fit-soft text-fit min-h-8 gap-1"
                    onClick={() => setPicked((p) => p.filter((x) => x !== id))}
                    aria-label={`${byId.get(id)?.label ?? id} ×`}
                  >
                    {byId.get(id)?.label ?? id}
                    <X className="size-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={f.skillsSearch}
            aria-label={f.skillsSearch}
            dir="ltr"
          />
          {matches.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" dir="ltr">
              {matches.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="toggle-chip min-h-9 px-2.5 text-xs"
                    disabled={picked.length >= 20}
                    onClick={() => {
                      setPicked((p) => [...p, s.id]);
                      setQ("");
                    }}
                  >
                    + {s.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      )}
      <div>
        <label className="label" htmlFor="doc-notes">
          {f.notes}
        </label>
        <textarea
          id="doc-notes"
          name="notes"
          className="input min-h-20"
          defaultValue={doc.notes ?? ""}
          maxLength={1000}
          dir="auto"
        />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm font-semibold">
          {error.text}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="min-h-11 flex-1">
          {t.save}
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}
