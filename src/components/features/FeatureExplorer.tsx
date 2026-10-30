"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { ChangelogEntry } from "@/features";
import { type Feature, type FeatureCategory } from "@/features/types";
import { featureHref, searchText } from "@/features";
import { cn } from "@/lib/utils";

const REPO = "https://github.com/guyhazut2000/job-hunt";
type StatusFilter = "all" | "new" | "live" | "beta" | "planned";
const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "הכול" },
  { id: "new", label: "חדש" },
  { id: "live", label: "פעיל" },
  { id: "beta", label: "בטא" },
  { id: "planned", label: "בתכנון" },
];

const fmtDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });

const chip =
  "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors " +
  "hover:bg-muted aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:border-primary";

export function FeatureExplorer({
  features,
  newIds,
  categories,
  changelog,
}: {
  features: Feature[];
  newIds: string[];
  categories: { category: FeatureCategory; label: string; live: number; planned: number }[];
  changelog: ChangelogEntry[];
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<FeatureCategory | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const isNewSet = useMemo(() => new Set(newIds), [newIds]);
  const index = useMemo(() => new Map(features.map((f) => [f.id, searchText(f)])), [features]);

  const visible = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return features.filter((f) => {
      if (cat !== "all" && f.category !== cat) return false;
      if (status === "new" && !isNewSet.has(f.id)) return false;
      if (status !== "all" && status !== "new" && f.status !== status) return false;
      const text = index.get(f.id) ?? "";
      return words.every((w) => text.includes(w));
    });
  }, [features, q, cat, status, isNewSet, index]);

  const current = visible.filter((f) => f.status !== "planned");
  const planned = visible.filter((f) => f.status === "planned");
  const groups = categories
    .map((c) => ({ ...c, items: current.filter((f) => f.category === c.category) }))
    .filter((g) => g.items.length > 0);
  const filtered = q.trim() !== "" || cat !== "all" || status !== "all";
  const days = [...new Set(changelog.map((c) => c.date))].slice(0, 10);

  return (
    <div className="flex flex-col gap-8">
      <section aria-label="חיפוש וסינון" className="bg-card flex flex-col gap-4 rounded-2xl border p-4">
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש יכולת, למשל: מפה, טלגרם, Gmail, קורות חיים"
            aria-label="חיפוש יכולת"
            className="ps-9"
            data-testid="features-search"
          />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs font-semibold">קטגוריה</p>
          <div className="scroll-chips flex flex-wrap gap-2">
            <button type="button" className={chip} aria-pressed={cat === "all"} onClick={() => setCat("all")}>
              הכול
            </button>
            {categories.map((c) => (
              <button
                key={c.category}
                type="button"
                className={chip}
                aria-pressed={cat === c.category}
                onClick={() => setCat(c.category)}
              >
                {c.label}
                <span className="text-xs opacity-70">{c.live + c.planned}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs font-semibold">סטטוס</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={chip}
                aria-pressed={status === s.id}
                onClick={() => setStatus(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        {filtered && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground" aria-live="polite">
              {visible.length === 0 ? "לא נמצאו יכולות" : `נמצאו ${visible.length} יכולות`}
            </span>
            <button
              type="button"
              className="text-primary inline-flex min-h-10 items-center gap-1 font-semibold hover:underline"
              onClick={() => {
                setQ("");
                setCat("all");
                setStatus("all");
              }}
            >
              <X className="size-4" aria-hidden />
              ניקוי
            </button>
          </div>
        )}
      </section>

      {groups.map((g) => (
        <section key={g.category} aria-labelledby={`cat-${g.category}`} className="flex flex-col gap-3">
          <h2 id={`cat-${g.category}`} className="text-2xl font-bold">
            {g.label} <span className="text-muted-foreground text-base font-semibold">({g.items.length})</span>
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {g.items.map((f) => (
              <FeatureCard key={f.id} f={f} isNew={isNewSet.has(f.id)} />
            ))}
          </ul>
        </section>
      ))}

      {planned.length > 0 && (
        <section aria-labelledby="planned" className="flex flex-col gap-3">
          <h2 id="planned" className="text-2xl font-bold">
            בתכנון <span className="text-muted-foreground text-base font-semibold">({planned.length})</span>
          </h2>
          <p className="text-muted-foreground text-sm">
            יכולות שעוד לא עלו לאוויר. כשהן עולות הן עוברות לקטגוריה שלהן.
          </p>
          <ul className="grid gap-3 md:grid-cols-2">
            {planned.map((f) => (
              <FeatureCard key={f.id} f={f} isNew={false} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="whats-new" className="rule-double flex flex-col gap-4 pt-6" id="whats-new-section">
        <h2 id="whats-new" className="text-2xl font-bold">
          מה חדש
        </h2>
        <ol className="flex flex-col gap-5">
          {days.map((d) => (
            <li key={d} className="flex flex-col gap-2">
              <h3 className="kicker">{fmtDate(d)}</h3>
              <ul className="flex flex-col gap-1.5">
                {changelog
                  .filter((c) => c.date === d)
                  .map((c, i) => (
                    <li key={`${c.featureId}-${i}`} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <Badge variant={c.kind === "added" ? "default" : c.kind === "planned" ? "outline" : "secondary"}>
                        {c.kind === "added" ? "חדש" : c.kind === "planned" ? "בתכנון" : "שיפור"}
                      </Badge>
                      <a href={`#${c.featureId}`} className="font-semibold hover:underline">
                        {c.featureName}
                      </a>
                      <span className="text-foreground/75">{c.text}</span>
                      {c.pr && <RefLink kind="pull" n={c.pr} />}
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function RefLink({ kind, n }: { kind: "pull" | "issues"; n: number }) {
  return (
    <a
      href={`${REPO}/${kind}/${n}`}
      target="_blank"
      rel="noreferrer"
      className="text-muted-foreground hover:text-foreground inline-flex min-h-6 min-w-6 items-center justify-center gap-0.5 font-mono text-xs"
      dir="ltr"
    >
      #{n}
    </a>
  );
}

function FeatureCard({ f, isNew }: { f: Feature; isNew: boolean }) {
  const href = featureHref(f);
  return (
    <li
      id={f.id}
      className={cn(
        "bg-card flex scroll-mt-24 flex-col gap-2 rounded-xl border p-4",
        f.status === "planned" && "border-dashed",
      )}
      data-testid="feature-card"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg leading-snug font-bold">{f.name}</h3>
        {isNew && <Badge>חדש</Badge>}
        {f.status === "beta" && <Badge variant="secondary">בטא</Badge>}
        {f.status === "planned" && <Badge variant="outline">בתכנון</Badge>}
        {f.audience === "user" && f.status !== "planned" && (
          <Badge variant="ghost" className="text-muted-foreground">
            דורש התחברות
          </Badge>
        )}
        {f.audience === "admin" && (
          <Badge variant="ghost" className="text-muted-foreground">
            למנהלים
          </Badge>
        )}
      </div>
      <p className="text-foreground/85 text-sm leading-relaxed">{f.description}</p>
      {f.howTo && (
        <p className="text-sm leading-relaxed">
          <span className="font-semibold">איך משתמשים: </span>
          {f.howTo}
        </p>
      )}
      <div className="text-muted-foreground mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs">
        <span>
          {f.status === "planned" ? "נוסף לתכנון" : "עלה"}: {fmtDate(f.added)}
        </span>
        {f.prs && f.prs.length > 0 && (
          <span className="inline-flex flex-wrap items-center gap-1">
            PR:{" "}
            {f.prs.map((n) => (
              <RefLink key={n} kind="pull" n={n} />
            ))}
          </span>
        )}
        {f.issue && (
          <span className="inline-flex items-center gap-1">
            Issue: <RefLink kind="issues" n={f.issue} />
          </span>
        )}
        {href && href !== "/features" && !href.startsWith("/features#") && (
          <Link
            href={href}
            className="text-primary ms-auto inline-flex min-h-10 items-center gap-1 text-sm font-semibold hover:underline"
          >
            לעמוד
            <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
          </Link>
        )}
        {f.status === "planned" && f.issue && (
          <a
            href={`${REPO}/issues/${f.issue}`}
            target="_blank"
            rel="noreferrer"
            className="text-primary ms-auto inline-flex min-h-10 items-center gap-1 text-sm font-semibold hover:underline"
          >
            לפרטים ב-GitHub
            <ExternalLink className="size-4" aria-hidden />
          </a>
        )}
      </div>
    </li>
  );
}
