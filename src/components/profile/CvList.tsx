import { Download, FileText, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { deleteCv, setDefaultCv } from "@/app/profile/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export interface CvRow {
  id: string;
  label: string | null;
  fileName: string;
  sizeBytes: number;
  isPrimary: boolean;
  createdAt: Date;
  appliedAt: Date | null;
  hasFile: boolean;
  skills: string[];
}

const kb = (n: number) =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

export function CvList({ t, rows, dateLocale }: { t: Dictionary["pv2"]; rows: CvRow[]; dateLocale: string }) {
  if (!rows.length)
    return (
      <p className="text-muted-foreground bg-card rounded-lg border border-dashed p-6 text-center text-sm">{t.noCvs}</p>
    );
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li
          key={r.id}
          className={`bg-card flex flex-col gap-3 rounded-lg border p-4 ${r.isPrimary ? "border-foreground border-2" : ""}`}
        >
          <div className="flex items-start gap-3">
            <FileText className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold break-words">{r.label || r.fileName}</h3>
                {r.isPrimary && (
                  <Badge className="bg-foreground text-background">
                    <Star className="size-3" aria-hidden />
                    {t.default}
                  </Badge>
                )}
                {r.appliedAt && (
                  <Badge variant="outline" className="text-fit border-fit/40">
                    {t.reviewed}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-1.5 font-mono text-xs">
                {r.label && (
                  <>
                    <bdi className="break-all">{r.fileName}</bdi>
                    <span aria-hidden>·</span>
                  </>
                )}
                <bdi>{kb(r.sizeBytes)}</bdi>
                <span aria-hidden>·</span>
                <time dateTime={r.createdAt.toISOString()}>{formatDateTime(r.createdAt, dateLocale)}</time>
              </p>
              {r.skills.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1" dir="ltr" aria-label="skills">
                  {r.skills.slice(0, 8).map((s) => (
                    <li key={s} className="chip">
                      {s}
                    </li>
                  ))}
                  {r.skills.length > 8 && (
                    <li dir="ltr" className="chip">
                      +{r.skills.length - 8}
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button asChild variant="outline" size="sm">
              <Link href={`/profile/review/${r.id}`}>{t.review}</Link>
            </Button>
            {r.hasFile && (
              <Button asChild variant="ghost" size="sm">
                <a href={`/api/cv/${r.id}`} download>
                  <Download data-icon="inline-start" />
                  {t.download}
                </a>
              </Button>
            )}
            {!r.isPrimary && (
              <form action={setDefaultCv}>
                <input type="hidden" name="id" value={r.id} />
                <Button type="submit" variant="ghost" size="sm">
                  <Star data-icon="inline-start" />
                  {t.setDefault}
                </Button>
              </form>
            )}
            <form action={deleteCv} className="ms-auto">
              <input type="hidden" name="id" value={r.id} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-destructive"
                aria-label={`${t.delete}: ${r.label || r.fileName}`}
              >
                <Trash2 data-icon="inline-start" />
                {t.delete}
              </Button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
