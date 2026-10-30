"use client";

import { Download, FileText, Search, Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DOCUMENT_TYPES, type DocumentTypeKey } from "@/lib/documents/constants";
import { formatBytes } from "@/lib/documents/validate";
import { filterDocuments, type ExpiryFilter } from "@/lib/documents/filter";
import type { DocumentStrings } from "@/lib/i18n/documents";
import { DocumentCard } from "./DocumentCard";
import { EditDocumentSheet } from "./EditDocumentSheet";
import { PreviewSheet } from "./PreviewSheet";
import type { CvSummary, DocumentRow, SkillOption } from "./types";
import type { StorageMode } from "./upload-client";

export function DocumentsManager({
  t,
  docs,
  cvs,
  skills,
  mode,
  userId,
  dateLocale,
}: {
  t: DocumentStrings;
  docs: DocumentRow[];
  cvs: CvSummary[];
  skills: SkillOption[];
  mode: StorageMode;
  userId: string;
  dateLocale: string;
}) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<DocumentTypeKey | "all">("all");
  const [expiry, setExpiry] = useState<ExpiryFilter>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);

  const shown = useMemo(() => filterDocuments(docs, q, type, expiry), [docs, q, type, expiry]);
  const showCvs = (type === "all" || type === "CV") && expiry === "all" && cvs.length > 0;
  const cvsShown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? cvs.filter((c) => [c.title, c.fileName].some((s) => s.toLowerCase().includes(n))) : cvs;
  }, [cvs, q]);
  const groups = DOCUMENT_TYPES.filter((k) => k !== "CV")
    .map((k) => ({ k, items: shown.filter((d) => d.type === k) }))
    .filter((g) => g.items.length);
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const d of docs) c.set(d.type, (c.get(d.type) ?? 0) + 1);
    c.set("CV", cvs.length);
    return c;
  }, [docs, cvs]);
  const filtered = q.trim() !== "" || type !== "all" || expiry !== "all";
  const nothing = !groups.length && !(showCvs && cvsShown.length);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            className="input ps-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.search}
            aria-label={t.search}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <select
            className="select-native sm:w-48"
            value={type}
            onChange={(e) => setType(e.target.value as DocumentTypeKey | "all")}
            aria-label={t.typeLabel}
          >
            <option value="all">{t.allTypes}</option>
            {DOCUMENT_TYPES.filter((k) => counts.get(k)).map((k) => (
              <option key={k} value={k}>
                {t.types[k]} ({counts.get(k)})
              </option>
            ))}
          </select>
          <select
            className="select-native sm:w-40"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value as ExpiryFilter)}
            aria-label={t.filterExpiry}
          >
            <option value="all">
              {t.filterExpiry}: {t.expiryAll}
            </option>
            <option value="soon">{t.expirySoon}</option>
            <option value="expired">{t.expiryExpired}</option>
          </select>
        </div>
      </div>

      {nothing && (
        <p className="text-muted-foreground bg-card rounded-lg border border-dashed p-6 text-center text-sm">
          {filtered ? t.noMatch : t.empty}
        </p>
      )}

      {showCvs && cvsShown.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="g-CV">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="g-CV" className="font-heading text-xl font-bold">
              {t.types.CV} <span className="text-muted-foreground font-mono text-sm">{cvsShown.length}</span>
            </h2>
            <Link
              href="/profile?tab=documents"
              className="text-primary text-sm font-semibold underline underline-offset-4"
            >
              {t.manageCvs}
            </Link>
          </div>
          <p className="text-muted-foreground -mt-2 text-xs">{t.cvGroupHint}</p>
          <ul className="flex flex-col gap-3">
            {cvsShown.map((c) => (
              <li
                key={c.id}
                className={`bg-card flex items-center gap-3 rounded-lg border p-4 ${c.isPrimary ? "border-foreground border-2" : ""}`}
              >
                <FileText className="text-muted-foreground size-5 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold break-words" dir="auto">
                      {c.title}
                    </h3>
                    {c.isPrimary && (
                      <Badge className="bg-foreground text-background">
                        <Star className="size-3" aria-hidden />
                        {t.default}
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground font-mono text-xs">
                    <bdi className="break-all">{c.fileName}</bdi> · <bdi>{formatBytes(c.sizeBytes)}</bdi>
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a href={`/api/cv/${c.id}`} aria-label={`${t.download}: ${c.title}`}>
                    <Download aria-hidden />
                    <span className="max-sm:sr-only">{t.download}</span>
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.map((g) => (
        <section key={g.k} className="flex flex-col gap-3" aria-labelledby={`g-${g.k}`}>
          <h2 id={`g-${g.k}`} className="font-heading text-xl font-bold">
            {t.types[g.k]} <span className="text-muted-foreground font-mono text-sm">{g.items.length}</span>
          </h2>
          <ul className="flex flex-col gap-3">
            {g.items.map((d) => (
              <DocumentCard
                key={`${d.id}-${d.version}`}
                t={t}
                doc={d}
                dateLocale={dateLocale}
                mode={mode}
                userId={userId}
                skillLabels={skillMap}
                onEdit={() => setEditing(d.id)}
                onPreview={() => setPreviewing(d.id)}
              />
            ))}
          </ul>
        </section>
      ))}

      <EditDocumentSheet
        t={t}
        doc={docs.find((d) => d.id === editing) ?? null}
        skills={skills}
        onClose={() => setEditing(null)}
      />
      <PreviewSheet t={t} doc={docs.find((d) => d.id === previewing) ?? null} onClose={() => setPreviewing(null)} />
    </div>
  );
}
