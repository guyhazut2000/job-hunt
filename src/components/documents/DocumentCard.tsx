"use client";

import { Download, Eye, FileImage, FileText, Pencil, RefreshCw, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { deleteDocument, documentFileUrl, finalizeDocument, setDefaultDocument } from "@/app/documents/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ACCEPT_ATTR, isPreviewable } from "@/lib/documents/constants";
import { formatBytes, precheckUpload } from "@/lib/documents/validate";
import { formatDate } from "@/lib/format";
import type { DocumentStrings } from "@/lib/i18n/documents";
import { errorText } from "./DocumentUploader";
import { fill } from "./fmt";
import type { DocumentRow, SkillOption } from "./types";
import { UploadFailure, uploadToStorage, type StorageMode } from "./upload-client";

const asDate = (ymd: string) => new Date(`${ymd}T12:00:00Z`);

export function ExpiryBadge({ t, doc, dateLocale }: { t: DocumentStrings; doc: DocumentRow; dateLocale: string }) {
  if (doc.expiry === "expired")
    return (
      <Badge variant="destructive" className="font-semibold">
        {t.expired}
      </Badge>
    );
  if (doc.expiry === "soon")
    return (
      <Badge variant="outline" className="border-caution/40 bg-caution-soft text-caution font-semibold">
        {fill(t.expiresSoon, { days: doc.daysToExpiry ?? 0 })}
      </Badge>
    );
  if (doc.expiry === "valid" && doc.expiryDate)
    return (
      <span className="text-muted-foreground text-xs">
        {fill(t.expiresOn, { date: formatDate(asDate(doc.expiryDate), dateLocale, { year: "numeric" }) })}
      </span>
    );
  return null;
}

export function DocumentCard({
  t,
  doc,
  dateLocale,
  mode,
  userId,
  skillLabels,
  onEdit,
  onPreview,
}: {
  t: DocumentStrings;
  doc: DocumentRow;
  dateLocale: string;
  mode: StorageMode;
  userId: string;
  skillLabels: Map<string, SkillOption>;
  onEdit: () => void;
  onPreview: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const replaceRef = useRef<HTMLInputElement>(null);
  const Icon = doc.mimeType.startsWith("image/") ? FileImage : FileText;

  async function download() {
    const url = await documentFileUrl(doc.id, true);
    if (url) window.location.assign(url);
  }

  async function replace(file: File | undefined) {
    if (!file) return;
    const pre = precheckUpload(file);
    if (pre) return setMsg({ ok: false, text: errorText(t, pre) });
    setBusy(true);
    setMsg({ ok: true, text: t.uploading });
    try {
      const key = await uploadToStorage(file, { mode, userId, replacingBytes: doc.sizeBytes });
      const res = await finalizeDocument({ key, fileName: file.name, replaceId: doc.id });
      setMsg(res.ok ? { ok: true, text: t.replaceDone } : { ok: false, text: errorText(t, res.error) });
      if (res.ok) router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: errorText(t, e instanceof UploadFailure ? e.message : "generic") });
    } finally {
      setBusy(false);
      if (replaceRef.current) replaceRef.current.value = "";
    }
  }

  return (
    <li
      className={`bg-card flex flex-col gap-3 rounded-lg border p-4 ${doc.isDefault ? "border-foreground border-2" : ""} ${doc.expiry === "expired" ? "opacity-80" : ""}`}
    >
      <div className="flex items-start gap-3">
        <Icon className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold break-words" dir="auto">
              {doc.title}
            </h3>
            {doc.isDefault && (
              <Badge className="bg-foreground text-background">
                <Star className="size-3" aria-hidden />
                {t.default}
              </Badge>
            )}
            <ExpiryBadge t={t} doc={doc} dateLocale={dateLocale} />
          </div>
          {(doc.issuer || doc.issueDate) && (
            <p className="text-foreground/80 mt-0.5 text-sm" dir="auto">
              {doc.issuer}
              {doc.issuer && doc.issueDate && " · "}
              {doc.issueDate &&
                fill(t.issuedOn, { date: formatDate(asDate(doc.issueDate), dateLocale, { year: "numeric" }) })}
            </p>
          )}
          <p className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-1.5 font-mono text-xs">
            <bdi className="break-all">{doc.fileName}</bdi>
            <span aria-hidden>·</span>
            <bdi>{formatBytes(doc.sizeBytes)}</bdi>
            {doc.version > 1 && (
              <>
                <span aria-hidden>·</span>
                <span>{fill(t.version, { n: doc.version })}</span>
              </>
            )}
          </p>
          {(doc.tags.length > 0 || doc.skills.length > 0) && (
            <ul className="mt-2 flex flex-wrap gap-1" aria-label={t.fields.tags}>
              {doc.skills.map((s) => (
                <li key={`s-${s}`} className="chip bg-fit-soft text-fit" dir="ltr">
                  {skillLabels.get(s)?.label ?? s}
                </li>
              ))}
              {doc.tags.map((s) => (
                <li key={`t-${s}`} className="chip" dir="auto">
                  #{s}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {confirming ? (
        <div
          className="bg-destructive/5 border-destructive/30 flex flex-col gap-2 rounded-md border p-3"
          role="alertdialog"
          aria-label={t.delete}
        >
          <p className="text-sm font-semibold" dir="auto">
            {fill(t.confirmDelete, { title: doc.title })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await deleteDocument(doc.id);
                  router.refresh();
                })
              }
            >
              <Trash2 aria-hidden />
              {t.delete}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirming(false)} autoFocus>
              {t.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 border-t pt-3">
          {isPreviewable(doc.mimeType) && (
            <Button variant="outline" size="sm" onClick={onPreview}>
              <Eye aria-hidden />
              {t.preview}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => void download()}>
            <Download aria-hidden />
            {t.download}
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil aria-hidden />
            {t.edit}
          </Button>
          <Button variant="outline" size="sm" disabled={busy || !mode} onClick={() => replaceRef.current?.click()}>
            <RefreshCw aria-hidden className={busy ? "animate-spin" : undefined} />
            {t.replace}
          </Button>
          <input
            ref={replaceRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => void replace(e.target.files?.[0])}
          />
          {!doc.isDefault && (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await setDefaultDocument(doc.id);
                  router.refresh();
                })
              }
            >
              <Star aria-hidden />
              {t.makeDefault}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive ms-auto"
            onClick={() => setConfirming(true)}
          >
            <Trash2 aria-hidden />
            {t.delete}
          </Button>
        </div>
      )}
      {msg && (
        <p role="status" className={`text-sm font-semibold ${msg.ok ? "text-fit" : "text-destructive"}`}>
          {msg.text}
        </p>
      )}
    </li>
  );
}
