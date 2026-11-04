import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SuggestionsRefresher } from "@/components/SuggestionsRefresher";
import { db } from "@/lib/db";
import { suggestedBy, USER_SOURCE } from "@/lib/discovery/suggest";
import { MY_SUGGESTIONS_LIMIT, suggestionStatus, type SuggestionStatus } from "@/lib/discovery/suggestion-status";
import { formatDateTime } from "@/lib/format";
import type { SuggestCompanyStrings } from "@/lib/i18n/suggest-company";

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));

const TONE: Record<SuggestionStatus["kind"], "default" | "secondary" | "destructive" | "outline"> = {
  checking: "secondary",
  nightly: "outline",
  added: "default",
  review: "outline",
  rejected: "destructive",
  duplicate: "secondary",
};

/** "ההצעות שלי" — the signed-in user's company suggestions and what happened to each. */
export async function MySuggestions({
  userId,
  s,
  dateLocale,
}: {
  userId: string;
  s: SuggestCompanyStrings;
  dateLocale: string;
}) {
  const where = { source: USER_SOURCE, sourceUrl: suggestedBy(userId) };
  const [total, rows] = await Promise.all([
    db.startupCandidate.count({ where }),
    db.startupCandidate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MY_SUGGESTIONS_LIMIT,
      select: {
        id: true,
        name: true,
        website: true,
        status: true,
        createdAt: true,
        checkedAt: true,
        checkError: true,
        careersUrl: true,
        company: { select: { slug: true, _count: { select: { jobs: { where: { isActive: true } } } } } },
      },
    }),
  ]);
  if (!total) return null;
  const now = new Date();
  const items = rows.map((r) => ({
    ...r,
    st: suggestionStatus(
      { ...r, company: r.company ? { slug: r.company.slug, jobs: r.company._count.jobs } : null },
      now,
    ),
  }));
  return (
    <section
      id="my-suggestions"
      className="border-border flex scroll-mt-20 flex-col gap-2 rounded-lg border p-4"
      data-testid="my-suggestions"
    >
      <h2 className="font-heading text-lg font-bold">
        {s.mineTitle}{" "}
        <span className="text-muted-foreground text-sm font-normal">· {fill(s.mineCount, { n: total })}</span>
      </h2>
      <SuggestionsRefresher active={items.some((i) => i.st.kind === "checking")} />
      <ul className="divide-border divide-y">
        {items.map(({ id, name, website, st }) => (
          <li key={id} className="flex flex-col gap-1 py-2 text-sm" data-testid="my-suggestion" data-status={st.kind}>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="font-medium break-words">{name}</span>
              <Badge variant={TONE[st.kind]}>{s[st.kind]}</Badge>
              <span className="text-muted-foreground min-w-0 truncate text-xs" dir="ltr">
                {website.replace(/^https?:\/\//, "")}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              {st.kind === "checking" && s.checkingHint}
              {st.kind === "nightly" && fill(s.nightlyHint, { time: formatDateTime(st.at, dateLocale) })}
              {st.kind === "review" && `${s[`reason_${st.reason}`]} ${s.reviewHint}`}
              {st.kind === "rejected" && s.rejectedHint}
              {st.kind === "added" && (st.jobs ? fill(s.addedJobs, { n: st.jobs }) : s.addedNoJobs)}
              {(st.kind === "added" || st.kind === "duplicate") && st.companySlug && (
                <>
                  {st.kind === "added" ? " · " : ""}
                  <Link href={`/companies/${st.companySlug}`} className="text-primary hover:underline">
                    {s.openCompany}
                  </Link>
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
      {total > items.length && (
        <p className="text-muted-foreground text-xs">{fill(s.mineMore, { shown: items.length, total })}</p>
      )}
    </section>
  );
}
