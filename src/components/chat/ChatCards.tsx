"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Car,
  ExternalLink,
  GraduationCap,
  MapPin,
  TramFront,
  UserRound,
} from "lucide-react";
import type { Company, Job } from "@prisma/client";
import { DomainBadge } from "@/components/DomainBadge";
import { JobCard } from "@/components/JobCard";
import { MatchMeter } from "@/components/MatchMeter";
import { MatchReasons } from "@/components/profile/MatchReasons";
import type {
  ChatJobCard,
  ChatToolOutput,
  CompanyInfoOutput,
  ExplainMatchOutput,
  SearchJobsOutput,
} from "@/lib/chat/types";
import { isStageKind, STAGE_LABELS } from "@/lib/hiring/kinds";
import type { ChatStrings } from "@/lib/i18n/chat";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

/** Tool outputs are JSON (ISO dates, no description); JobCard wants a Prisma row. */
function asJob(c: ChatJobCard): Job & { company: Company } {
  return {
    ...c,
    description: "",
    postedAt: new Date(c.postedAt),
    linkedinCheckedAt: c.linkedinCheckedAt ? new Date(c.linkedinCheckedAt) : null,
  } as unknown as Job & { company: Company };
}

type CardProps = { t: Dictionary; s: ChatStrings; locale: Locale; onNavigate?: () => void };

function Shell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card min-w-0 overflow-hidden rounded-xl border text-start", className)}>{children}</div>
  );
}

function SeeAll({ href, label, onNavigate }: { href: string; label: string; onNavigate?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="text-primary hover:bg-muted/60 flex min-h-11 items-center justify-between gap-2 border-t px-4 text-sm font-semibold"
    >
      <span className="min-w-0 truncate">{label}</span>
      <ArrowLeft className="size-4 shrink-0 ltr:rotate-180" aria-hidden />
    </Link>
  );
}

function JobsResult({ out, t, s, onNavigate }: CardProps & { out: SearchJobsOutput }) {
  if (!out.jobs.length) {
    if (out.unknownCompany) return null;
    const c = out.applied.commute;
    return (
      <Shell>
        <div className="px-4 py-3 text-sm" data-chat-empty>
          <p className="font-medium">{s.noJobs}</p>
          {c && (
            <p className="text-muted-foreground mt-1 text-xs">
              {fill(s.commuteFrom, { from: c.from })}
              {c.estimated ? ` · ${s.commuteEstimated}` : ""}
            </p>
          )}
        </div>
        <SeeAll href={out.href} label={s.openSearch} onNavigate={onNavigate} />
      </Shell>
    );
  }
  const mode = out.applied.commute?.mode;
  return (
    <Shell>
      <div className="divide-y" onClickCapture={(e) => (e.target as HTMLElement).closest("a") && onNavigate?.()}>
        {out.jobs.map((c) => (
          <JobCard key={c.id} job={asJob(c)} t={t} score={c.score} commute={c.commute} commuteMode={mode} />
        ))}
      </div>
      {out.applied.commute?.estimated && (
        <p className="text-muted-foreground border-t px-4 py-2 text-xs">{s.commuteEstimated}</p>
      )}
      <SeeAll href={out.href} label={fill(s.seeAll, { n: out.total })} onNavigate={onNavigate} />
    </Shell>
  );
}

function Chips({ items, tone }: { items: string[]; tone: "fit" | "miss" }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((x) => (
        <li
          key={x}
          dir="auto"
          className={cn(
            "rounded-full border px-2 py-0.5 text-xs font-medium",
            tone === "fit"
              ? "bg-fit/10 text-fit border-fit/30"
              : "bg-destructive/5 text-destructive border-destructive/30",
          )}
        >
          {x}
        </li>
      ))}
    </ul>
  );
}

function MatchResult({ out, t, s, onNavigate }: CardProps & { out: ExplainMatchOutput }) {
  if (out.error === "no_profile")
    return (
      <Shell className="flex flex-col gap-2 p-4">
        <p className="text-sm">{s.noProfile}</p>
        <Link
          href="/profile"
          onClick={onNavigate}
          className="text-primary inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold"
        >
          <UserRound className="size-4" aria-hidden />
          {s.fillProfile}
        </Link>
      </Shell>
    );
  if (!out.job || out.score === undefined) return null;
  const job = out.job;
  return (
    <Shell>
      <div className="flex items-start gap-3 p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link
            href={`/companies/${job.company.slug}`}
            onClick={onNavigate}
            className="text-muted-foreground w-fit text-sm font-bold hover:underline"
          >
            {job.company.name}
          </Link>
          <Link
            href={`/jobs/${job.id}`}
            onClick={onNavigate}
            dir="auto"
            className="font-heading text-lg leading-snug font-bold [overflow-wrap:anywhere] hover:underline"
          >
            {job.title}
          </Link>
          <p className="text-foreground/75 flex items-center gap-1 text-sm">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{job.location}</span>
          </p>
        </div>
        <MatchMeter score={out.score} label={s.match} />
      </div>
      {!!out.reasons?.length && (
        <div className="border-t px-4 py-3">
          <MatchReasons t={t.match} reasons={out.reasons} />
        </div>
      )}
      {(!!out.matchedSkills?.length || !!out.missingSkills?.length) && (
        <div className="flex flex-col gap-2.5 border-t px-4 py-3">
          {!!out.matchedSkills?.length && (
            <div className="flex flex-col gap-1.5">
              <h4 className="kicker text-[0.65rem]">{s.matched}</h4>
              <Chips items={out.matchedSkills} tone="fit" />
            </div>
          )}
          {!!out.missingSkills?.length && (
            <div className="flex flex-col gap-1.5">
              <h4 className="kicker text-[0.65rem]">{s.missing}</h4>
              <Chips items={out.missingSkills} tone="miss" />
            </div>
          )}
        </div>
      )}
      {!!out.plan?.length && (
        <div className="flex flex-col gap-1.5 border-t px-4 py-3">
          <h4 className="kicker flex items-center gap-1.5 text-[0.65rem]">
            <GraduationCap className="size-3.5" aria-hidden />
            {s.plan}
          </h4>
          <ol className="flex flex-col gap-1 ps-5 text-sm">
            {out.plan.map((p) => (
              <li key={p.skill} className="list-decimal">
                <Link
                  href={p.href}
                  onClick={onNavigate}
                  className="text-primary font-semibold hover:underline"
                  dir="auto"
                >
                  {p.skill}
                </Link>
                <span className="text-muted-foreground"> · {fill(s.hours, { n: p.hours })}</span>
              </li>
            ))}
          </ol>
          {out.scoreAfterPlan !== undefined && out.scoreAfterPlan > out.score && (
            <p className="text-fit text-sm font-semibold">{fill(s.afterPlan, { n: out.scoreAfterPlan })}</p>
          )}
        </div>
      )}
      <SeeAll href={`/jobs/${job.id}`} label={s.jobPage} onNavigate={onNavigate} />
    </Shell>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const safeHttp = (url: string | null | undefined) => (url && /^https?:\/\//i.test(url) ? url : null);

function CompanyResult({ out, s, locale, onNavigate }: CardProps & { out: CompanyInfoOutput }) {
  if (out.error === "not_found" || !out.company) {
    if (!out.alternatives?.length) return null;
    return (
      <Shell className="flex flex-col gap-2 p-4 text-sm">
        <p>{s.didYouMean}</p>
        <ul className="flex flex-wrap gap-2">
          {out.alternatives.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/companies/${a.slug}`}
                onClick={onNavigate}
                className="text-primary font-semibold hover:underline"
              >
                {a.name}
              </Link>
            </li>
          ))}
        </ul>
      </Shell>
    );
  }
  const c = out.company;
  const h = out.hiring;
  const mins = out.commute?.minutes ?? {};
  return (
    <Shell>
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <Building2 className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <Link
            href={`/companies/${c.slug}`}
            onClick={onNavigate}
            className="font-heading min-w-0 truncate text-lg font-bold hover:underline"
          >
            {c.name}
          </Link>
        </div>
        <p className="text-foreground/75 text-sm">
          {fill(s.openJobs, { n: out.activeJobs ?? 0 })}
          {c.industry ? ` · ${c.industry}` : ""}
        </p>
        {!!out.domains?.length && (
          <ul className="flex flex-wrap gap-1.5" aria-label={s.domains}>
            {out.domains.slice(0, 6).map((d) => (
              <li key={d.domain} className="min-w-0">
                <DomainBadge domain={d.domain} locale={locale} size="sm" />
              </li>
            ))}
          </ul>
        )}
        {!!out.locations?.length && (
          <p className="text-foreground/75 flex items-start gap-1 text-sm">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 [overflow-wrap:anywhere]">{out.locations.slice(0, 5).join(" · ")}</span>
          </p>
        )}
        {out.commute && (mins.car != null || mins.transit != null) && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-muted-foreground">{fill(s.commuteFrom, { from: out.commute.from })}:</span>
            {mins.transit != null && (
              <span className="inline-flex items-center gap-1">
                <TramFront className="size-3.5" aria-hidden />
                {fill(s.minutes, { n: mins.transit })} {s.transit}
              </span>
            )}
            {mins.car != null && (
              <span className="inline-flex items-center gap-1">
                <Car className="size-3.5" aria-hidden />
                {fill(s.minutes, { n: mins.car })} {s.car}
              </span>
            )}
            {out.commute.estimated && <span className="text-muted-foreground text-xs">({s.commuteEstimated})</span>}
          </p>
        )}
      </div>

      {h && (
        <div className="flex flex-col gap-2 border-t px-4 py-3">
          <h4 className="kicker flex items-center gap-1.5 text-[0.65rem]">
            <BadgeCheck className="size-3.5" aria-hidden />
            {s.hiring}
          </h4>
          {h.status === "found" && h.stages.length > 0 ? (
            <>
              <ol className="flex flex-col gap-1.5 ps-5 text-sm">
                {h.stages.map((st, i) => (
                  <li key={i} className="list-decimal">
                    <span className="font-semibold">
                      {isStageKind(st.kind) ? STAGE_LABELS[locale][st.kind] : st.title}
                    </span>
                    {isStageKind(st.kind) && st.title && st.title !== STAGE_LABELS[locale][st.kind] && (
                      <span className="text-foreground/75" dir="auto">
                        {" "}
                        – {st.title}
                      </span>
                    )}
                    {st.duration && <span className="text-muted-foreground"> · {st.duration}</span>}
                  </li>
                ))}
              </ol>
              {h.duration && (
                <p className="text-muted-foreground text-xs">{fill(s.hiringDuration, { d: h.duration })}</p>
              )}
              {!!h.sources.length && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="text-muted-foreground">{s.hiringSources}:</span>
                  {h.sources.map((src) =>
                    safeHttp(src.url) ? (
                      <a
                        key={src.url}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-primary inline-flex min-h-8 items-center gap-1 hover:underline"
                      >
                        {hostOf(src.url)}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : null,
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-foreground/75 text-sm">{h.status === "none" ? s.hiringNone : s.hiringUnknown}</p>
          )}
          {h.mine && <p className="text-muted-foreground text-xs">{s.hiringMine}</p>}
        </div>
      )}

      {!!out.community?.length && (
        <div className="flex flex-col gap-1.5 border-t px-4 py-3">
          <h4 className="kicker text-[0.65rem]">{s.community}</h4>
          <ul className="flex flex-wrap gap-2">
            {out.community.map((l) =>
              safeHttp(l.url) ? (
                <li key={l.id}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="hover:bg-muted inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-xs font-medium"
                  >
                    {l.site}
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                </li>
              ) : null,
            )}
          </ul>
        </div>
      )}

      {!!out.topJobs?.length && (
        <div className="flex flex-col gap-1 border-t px-4 py-3">
          <h4 className="kicker text-[0.65rem]">{s.topJobs}</h4>
          <ul className="flex flex-col">
            {out.topJobs.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/jobs/${j.id}`}
                  onClick={onNavigate}
                  className="hover:bg-muted/60 -mx-2 flex min-h-10 items-center justify-between gap-2 rounded-md px-2 text-sm"
                >
                  <span className="min-w-0 truncate font-semibold" dir="auto">
                    {j.title}
                  </span>
                  {j.score !== undefined && (
                    <span className="text-muted-foreground shrink-0 font-mono text-xs">{j.score}%</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <SeeAll href={`/companies/${c.slug}`} label={s.companyPage} onNavigate={onNavigate} />
    </Shell>
  );
}

export function ChatToolCard({ out, ...props }: CardProps & { out: ChatToolOutput }) {
  if (out.kind === "jobs") return <JobsResult out={out} {...props} />;
  if (out.kind === "match") return <MatchResult out={out} {...props} />;
  if (out.kind === "company") return <CompanyResult out={out} {...props} />;
  return null;
}
