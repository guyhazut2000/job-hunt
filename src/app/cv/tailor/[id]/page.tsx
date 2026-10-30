import { ArrowLeft, FileDown, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CvWorkspace } from "@/components/cv-tailor/CvWorkspace";
import { GenerateForm } from "@/components/cv-tailor/GenerateForm";
import { MatchCard, SuggestionsCard } from "@/components/cv-tailor/MatchCard";
import { VersionList } from "@/components/cv-tailor/VersionList";
import { Button } from "@/components/ui/button";
import type { AiLimitReason } from "@/lib/ai/errors";
import { aiRemaining } from "@/lib/ai/remaining";
import { versionsFor } from "@/lib/cv-tailor/server";
import type { Suggestion } from "@/lib/cv-tailor/tailor";
import type { CvDoc, CvLanguage, MatchSummary, TailorSource } from "@/lib/cv-tailor/types";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { aiLimitMessage } from "@/lib/i18n/ai";
import { cvTailorStrings } from "@/lib/i18n/cv-tailor";
import { fmt } from "@/lib/i18n/learning";
import { requireUser } from "@/lib/session";
import { deleteTailoredAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tailored CV" };

const LIMITS: AiLimitReason[] = ["user_daily", "global_daily", "global_minute", "provider_quota"];

export default async function TailoredCvPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reverted?: string; limit?: string }>;
}) {
  const user = await requireUser();
  const locale = await getLocale();
  const t = cvTailorStrings(locale);
  const { id } = await params;
  const sp = await searchParams;
  const row = await db.tailoredCv.findFirst({ where: { id, userId: user.id } });
  if (!row) notFound();
  const [versions, remaining] = await Promise.all([
    versionsFor(user.id, row.jobId, row.applicationId),
    aiRemaining(user.id),
  ]);
  const doc = row.content as unknown as CvDoc;
  const base = row.base as unknown as CvDoc;
  const match = row.match as unknown as MatchSummary;
  const suggestions = (row.suggestions ?? []) as unknown as Suggestion[];
  const language = (row.language === "en" ? "en" : "he") as CvLanguage;
  const highlight = match.covered.filter((r) => r.kind === "tech").map((r) => r.label);
  const reverted = Number(sp.reverted) || 0;
  const limit = LIMITS.find((l) => l === sp.limit);
  const source = row.source as TailorSource;

  return (
    <div className="flex flex-col gap-6">
      <header className="rule-double flex flex-col gap-1 pb-4">
        <p className="kicker">{t.title}</p>
        <h1 className="font-heading text-title font-black" dir="auto">
          {row.title} · {row.company}
        </h1>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="bg-secondary rounded-full px-2.5 py-0.5 font-semibold">
            {fmt(t.version, { n: row.version })}
          </span>
          <span
            data-testid="cvt-source"
            className={
              source === "ai"
                ? "bg-fit-soft text-fit rounded-full px-2.5 py-0.5 font-semibold"
                : "bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 font-semibold"
            }
          >
            {t.source[source] ?? row.source}
          </span>
          <span className="text-muted-foreground">{language === "en" ? t.langEn : t.langHe}</span>
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button asChild className="rounded-full">
            <Link href={`/cv/tailor/${row.id}/print`} data-testid="cvt-export">
              <FileDown className="size-4" aria-hidden />
              {t.exportPdf}
            </Link>
          </Button>
          {row.jobId && (
            <Button asChild variant="ghost" className="rounded-full">
              <Link href={`/jobs/${row.jobId}`}>
                <ArrowLeft className="size-4 rotate-180 ltr:rotate-0" aria-hidden />
                {t.backToJob}
              </Link>
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-2 text-sm">
        <p className="text-muted-foreground inline-flex items-start gap-1.5">
          <ShieldCheck className="text-fit mt-0.5 size-4 shrink-0" aria-hidden />
          {t.rules}
        </p>
        {reverted > 0 && (
          <p className="bg-caution-soft text-caution rounded-md px-3 py-2">{fmt(t.reverted, { n: reverted })}</p>
        )}
        {limit && <p className="bg-caution-soft text-caution rounded-md px-3 py-2">{aiLimitMessage(limit, locale)}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <CvWorkspace id={row.id} base={base} initial={doc} language={language} highlight={highlight} t={t} />
        <aside className="flex flex-col gap-4">
          <MatchCard match={match} t={t} />
          <SuggestionsCard suggestions={suggestions} t={t} />
          <section className="bg-card flex flex-col gap-3 rounded-xl border p-4">
            <h2 className="font-bold">{t.versions}</h2>
            <VersionList versions={versions} current={row.id} t={t} locale={locale} />
            <p className="text-muted-foreground text-xs" data-testid="cvt-remaining">
              {remaining == null ? t.aiOff : fmt(t.remaining, { n: remaining })}
            </p>
            <GenerateForm
              jobId={row.jobId}
              applicationId={row.jobId ? null : row.applicationId}
              detected={language}
              needsText={false}
              regenerate
              t={t}
            />
            <form action={deleteTailoredAction}>
              <input type="hidden" name="id" value={row.id} />
              <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                <Trash2 className="size-4" aria-hidden />
                {t.delete}
              </Button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
