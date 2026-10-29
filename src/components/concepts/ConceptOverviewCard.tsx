"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  BookOpen,
  Bot,
  ExternalLink,
  Lightbulb,
  Loader2,
  PenLine,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { requestOverview } from "@/app/learn/concepts/actions";
import { Skeleton } from "@/components/ui/skeleton";
import { companyConceptSlug, conceptSlug, type ConceptOverview, type OverviewSource } from "@/lib/concepts/core";
import type { ConceptStrings } from "@/lib/i18n/concepts";
import { SuggestionChips } from "./SuggestionChips";

export interface OverviewInit {
  overview: ConceptOverview;
  source: OverviewSource;
  pending: boolean;
}

export function ConceptOverviewCard({
  conceptId,
  init,
  t,
  company,
  existing,
}: {
  conceptId: string;
  init: OverviewInit;
  t: ConceptStrings;
  /** Set for company concepts: related concepts are created under the same company. */
  company: { id: string; slug: string } | null;
  /** The user's concept ids by slug, so related chips open instead of re-creating. */
  existing: Record<string, string>;
}) {
  const [state, setState] = useState(init);
  const [notice, setNotice] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [loading, start] = useTransition();
  const asked = useRef(false);

  const generate = () =>
    start(async () => {
      const r = await requestOverview(conceptId).catch(() => null);
      if (!r) return setNotice(t.errorGeneric);
      setState({ overview: r.overview, source: r.source, pending: !!(r.notice || r.offline) });
      setNotice(r.notice ?? null);
      setOffline(!!r.offline);
    });

  useEffect(() => {
    if (init.pending && !asked.current) {
      asked.current = true;
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const o = state.overview;
  const showSkeleton = loading && state.pending && state.source === "fallback";
  const slugOf = (name: string) => (company ? companyConceptSlug(company.slug, name) : conceptSlug(name));

  return (
    <section
      aria-labelledby="overview"
      className="bg-card flex flex-col gap-4 rounded-2xl border p-4 shadow-sm sm:p-6"
      data-testid="concept-overview"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="overview" className="text-xl font-bold">
          {t.overviewTitle}
        </h2>
        <SourceTag source={state.source} t={t} />
      </div>

      {showSkeleton ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <p className="text-muted-foreground inline-flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t.generating}
          </p>
          <Skeleton className="h-5 w-11/12" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      ) : (
        <>
          {(notice || offline) && (
            <div
              role="status"
              className="bg-caution-soft/60 text-foreground flex flex-wrap items-start justify-between gap-2 rounded-lg p-3 text-sm"
            >
              <span className="inline-flex items-start gap-2">
                <AlertTriangle className="text-caution mt-0.5 size-4 shrink-0" aria-hidden />
                {notice ?? t.offlineNote}
              </span>
              {!offline && (
                <button
                  type="button"
                  onClick={generate}
                  className="text-primary inline-flex min-h-8 items-center gap-1 font-semibold hover:underline"
                >
                  <RefreshCw className="size-3.5" aria-hidden />
                  {t.regenerate}
                </button>
              )}
            </div>
          )}
          <dl className="grid gap-4 md:grid-cols-3">
            <Field icon={<BookOpen className="size-4" aria-hidden />} label={t.whatIs} text={o.summary} />
            {o.why && <Field icon={<Lightbulb className="size-4" aria-hidden />} label={t.why} text={o.why} />}
            {o.how && <Field icon={<PenLine className="size-4" aria-hidden />} label={t.how} text={o.how} />}
          </dl>
          {o.example.code && (
            <figure className="flex flex-col gap-1.5">
              <figcaption className="kicker inline-flex items-center gap-1.5">
                <Terminal className="size-3.5" aria-hidden />
                {t.example}
              </figcaption>
              <pre
                dir="ltr"
                className="bg-secondary overflow-x-auto rounded-lg p-3 text-start font-mono text-[0.85rem] leading-relaxed"
              >
                <code>{o.example.code}</code>
              </pre>
              {o.example.caption && <p className="text-foreground/75 text-sm">{o.example.caption}</p>}
            </figure>
          )}
          {o.keyPoints.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h3 className="kicker">{t.keyPoints}</h3>
              <ul className="flex list-disc flex-col gap-1 ps-5 leading-relaxed">
                {o.keyPoints.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            </div>
          )}
          {o.related.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="kicker">{t.relatedTitle}</h3>
              <SuggestionChips
                testId="concept-related"
                items={o.related.map((r) => ({
                  name: r.name,
                  hint: r.why,
                  kind: company ? "COMPANY" : "TECH",
                  companyId: company?.id ?? null,
                  parentId: conceptId,
                  source: "related",
                  existingId: existing[slugOf(r.name)] ?? null,
                }))}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Field({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-primary inline-flex items-center gap-1.5 text-sm font-bold">
        {icon}
        {label}
      </dt>
      <dd className="leading-relaxed">{text}</dd>
    </div>
  );
}

function SourceTag({ source, t }: { source: OverviewSource; t: ConceptStrings }) {
  const label = source === "ai" ? t.sourceAi : source === "curated" ? t.sourceCurated : t.sourceFallback;
  return (
    <span
      className="bg-secondary text-foreground/80 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
      data-testid="overview-source"
    >
      {source === "ai" ? <Bot className="size-3.5" aria-hidden /> : null}
      {label}
    </span>
  );
}

export function OutboundLink({ href, label, badge }: { href: string; label: string; badge?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold hover:underline"
    >
      <span dir="auto">{label}</span>
      <ExternalLink className="size-3.5 shrink-0" aria-hidden />
      {badge && (
        <span className="bg-secondary text-foreground/70 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold">
          {badge}
        </span>
      )}
    </a>
  );
}
