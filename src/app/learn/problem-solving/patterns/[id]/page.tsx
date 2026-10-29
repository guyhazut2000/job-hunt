import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageHead } from "@/components/problem-solving/PageHead";
import { DS_BY_ID } from "@/lib/algo/data-structures";
import { PATTERN_BY_ID, PATTERNS } from "@/lib/algo/patterns";
import { PROBLEMS } from "@/lib/algo/problems";
import { tr, type PatternId } from "@/lib/algo/types";
import { getLocale } from "@/lib/i18n";
import { problemSolvingStrings } from "@/lib/i18n/problem-solving";

export function generateStaticParams() {
  return PATTERNS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const p = PATTERN_BY_ID.get((await params).id as PatternId);
  return { title: p ? p.name : "Pattern" };
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="kicker">{title}</h2>
      {children}
    </section>
  );
}

export default async function PatternPage({ params }: { params: Promise<{ id: string }> }) {
  const p = PATTERN_BY_ID.get((await params).id as PatternId);
  if (!p) notFound();
  const locale = await getLocale();
  const t = problemSolvingStrings(locale);
  const problems = PROBLEMS.filter((x) => x.patterns.includes(p.id) || x.alsoOk?.includes(p.id));
  return (
    <article className="flex flex-col gap-7">
      <Link
        href="/learn/problem-solving/patterns"
        className="text-muted-foreground inline-flex w-fit items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t.patternsTitle}
      </Link>
      <PageHead kicker={t.family[p.family]} title={p.name} lead={tr(p.summary, locale)}>
        <dl className="flex flex-wrap gap-2 text-sm">
          <div className="bg-fit-soft text-fit rounded-full px-3 py-1">
            <dt className="inline">{t.time}: </dt>
            <dd dir="ltr" className="inline font-mono font-semibold">
              {p.time}
            </dd>
          </div>
          <div className="bg-secondary rounded-full px-3 py-1">
            <dt className="inline">{t.space}: </dt>
            <dd dir="ltr" className="inline font-mono font-semibold">
              {p.space}
            </dd>
          </div>
        </dl>
      </PageHead>
      <div className="grid gap-7 lg:grid-cols-2">
        <div className="flex flex-col gap-7">
          <Block title={t.signals}>
            <ul className="flex list-disc flex-col gap-1 ps-5 leading-relaxed">
              {p.signals.map((s) => (
                <li key={s.en}>{tr(s, locale)}</li>
              ))}
            </ul>
          </Block>
          <Block title={t.pitfalls}>
            <ul className="flex flex-col gap-1.5">
              {p.pitfalls.map((s) => (
                <li key={s.en} className="bg-caution-soft text-caution rounded-lg px-3 py-2 text-sm leading-relaxed">
                  {tr(s, locale)}
                </li>
              ))}
            </ul>
          </Block>
          {p.variants.length > 0 && (
            <Block title={t.variants}>
              <ul className="flex list-disc flex-col gap-1 ps-5 text-sm leading-relaxed">
                {p.variants.map((s) => (
                  <li key={s.en}>{tr(s, locale)}</li>
                ))}
              </ul>
            </Block>
          )}
        </div>
        <Block title={t.template}>
          <pre
            dir="ltr"
            className="bg-muted/60 overflow-x-auto rounded-xl border p-4 text-start font-mono text-[0.8rem] leading-relaxed"
          >
            {p.template}
          </pre>
        </Block>
      </div>
      <div className="grid gap-7 sm:grid-cols-2">
        <Block title={t.uses}>
          <ul className="flex flex-wrap gap-1.5">
            {p.uses.map((id) => (
              <li key={id}>
                <Link
                  href={`/learn/problem-solving/data-structures#${id}`}
                  dir="ltr"
                  className="bg-secondary hover:bg-muted inline-flex min-h-9 items-center rounded-full px-3 text-sm"
                >
                  {DS_BY_ID.get(id)?.name ?? id}
                </Link>
              </li>
            ))}
          </ul>
        </Block>
        <Block title={t.related}>
          <ul className="flex flex-wrap gap-1.5">
            {p.related.map((id) => (
              <li key={id}>
                <Link
                  href={`/learn/problem-solving/patterns/${id}`}
                  dir="ltr"
                  className="bg-secondary hover:bg-muted inline-flex min-h-9 items-center rounded-full px-3 text-sm"
                >
                  {PATTERN_BY_ID.get(id)?.name ?? id}
                </Link>
              </li>
            ))}
          </ul>
        </Block>
      </div>
      <Block title={t.examples}>
        <ul className="flex flex-col divide-y rounded-xl border">
          {problems.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <Link
                href={`/learn/problem-solving/practice/${x.id}`}
                className="font-semibold underline-offset-4 hover:underline"
                dir="ltr"
              >
                {x.title}
              </Link>
              <span className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">{t.difficulty[x.difficulty]}</span>
                {x.leetcode && (
                  <a
                    href={`https://leetcode.com/problems/${x.leetcode}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline"
                  >
                    LeetCode
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Block>
    </article>
  );
}
