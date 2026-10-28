import { ShieldCheck } from "lucide-react";
import { DocumentsManager } from "@/components/documents/DocumentsManager";
import { DocumentUploader } from "@/components/documents/DocumentUploader";
import { fill } from "@/components/documents/fmt";
import type { DocumentRow } from "@/components/documents/types";
import { Progress } from "@/components/ui/progress";
import { db } from "@/lib/db";
import { USER_QUOTA_BYTES } from "@/lib/documents/constants";
import { storageDriver } from "@/lib/documents/storage";
import { expiryStatus, formatBytes } from "@/lib/documents/validate";
import { getDictionary } from "@/lib/i18n";
import { documentStrings } from "@/lib/i18n/documents";
import { GRAPH } from "@/lib/learning/graph";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents" };

const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export default async function DocumentsPage() {
  const user = await requireUser();
  const { locale, t: dict } = await getDictionary();
  const t = documentStrings(locale);
  const [docs, resumes] = await Promise.all([
    db.document.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      omit: { storageKey: true, sha256: true, userId: true },
    }),
    db.resume.findMany({
      where: { userId: user.id },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      select: { id: true, label: true, fileName: true, sizeBytes: true, isPrimary: true, createdAt: true },
    }),
  ]);
  const now = new Date();
  const rows: DocumentRow[] = docs.map((d) => ({
    id: d.id,
    type: d.type,
    title: d.title,
    issuer: d.issuer,
    issueDate: ymd(d.issueDate),
    expiryDate: ymd(d.expiryDate),
    language: d.language,
    tags: d.tags,
    notes: d.notes,
    skills: d.skills,
    fileName: d.fileName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    version: d.version,
    isDefault: d.isDefault,
    createdAt: d.createdAt.toISOString(),
    expiry: expiryStatus(d.expiryDate, now),
    daysToExpiry: d.expiryDate ? Math.max(0, Math.ceil((d.expiryDate.getTime() - now.getTime()) / 86_400_000)) : null,
  }));
  const used = docs.reduce((s, d) => s + d.sizeBytes, 0);
  const skills = GRAPH.nodes.map((n) => ({ id: n.id, label: n.label })).sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="flex flex-col gap-6">
      <header className="rule-double flex flex-col gap-1 pb-4">
        <p className="kicker">{t.kicker}</p>
        <h1 className="font-heading text-title font-black">{t.title}</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">{t.intro}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="min-w-0">
          <DocumentsManager
            t={t}
            docs={rows}
            cvs={resumes.map((r) => ({
              id: r.id,
              title: r.label || r.fileName,
              fileName: r.fileName,
              sizeBytes: r.sizeBytes,
              isPrimary: r.isPrimary,
              createdAt: r.createdAt.toISOString(),
            }))}
            skills={skills}
            mode={storageDriver()}
            userId={user.id}
            dateLocale={dict.dateLocale}
          />
        </div>
        <aside className="order-first flex flex-col gap-4 lg:sticky lg:top-24 lg:order-none">
          <section className="form-section" aria-labelledby="upload-h">
            <h2 id="upload-h" className="font-heading text-xl font-bold">
              {t.uploadTitle}
            </h2>
            <DocumentUploader t={t} mode={storageDriver()} userId={user.id} />
            <div className="flex flex-col gap-1.5">
              <Progress value={(used / USER_QUOTA_BYTES) * 100} aria-label={t.usage} />
              <p className="text-muted-foreground font-mono text-xs">
                {fill(t.usage, { used: formatBytes(used || 0), limit: formatBytes(USER_QUOTA_BYTES) })}
              </p>
            </div>
            <p className="text-muted-foreground flex gap-2 text-xs">
              <ShieldCheck className="size-4 shrink-0" aria-hidden />
              {t.privacy}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
