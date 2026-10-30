import Link from "next/link";
import type { Locale } from "@/lib/i18n/dictionaries";
import type { CvTailorStrings } from "@/lib/i18n/cv-tailor";
import { fmt } from "@/lib/i18n/learning";
import type { TailorSource } from "@/lib/cv-tailor/types";

export interface VersionRow {
  id: string;
  version: number;
  source: string;
  language: string;
  createdAt: Date;
}

export function VersionList({
  versions,
  current,
  t,
  locale,
}: {
  versions: VersionRow[];
  current?: string;
  t: CvTailorStrings;
  locale: Locale;
}) {
  const df = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "he-IL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem",
  });
  return (
    <ul className="flex flex-col gap-1" data-testid="cvt-versions">
      {versions.map((v) => (
        <li key={v.id}>
          <Link
            href={`/cv/tailor/${v.id}`}
            aria-current={v.id === current ? "page" : undefined}
            className="hover:bg-secondary/60 aria-[current=page]:bg-secondary flex min-h-11 flex-wrap items-center justify-between gap-x-3 rounded-md px-2 py-1.5 text-sm"
          >
            <span className="font-semibold">{fmt(t.version, { n: v.version })}</span>
            <span className="text-muted-foreground text-xs">
              {t.source[v.source as TailorSource] ?? v.source} · {v.language === "en" ? "EN" : "עב"} ·{" "}
              <span dir="ltr">{df.format(v.createdAt)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
