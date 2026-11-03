import Link from "next/link";
import type { Seniority } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getDictionary } from "@/lib/i18n";
import { localizedTitle } from "@/lib/i18n/titles";
import { fillS, stepUpStrings } from "@/lib/i18n/step-up";
import { LADDER, MOVE_KINDS, ROLE_UP, nextRung, technicalTrackOpen, type MoveKind } from "@/lib/career/ladder";
import { loadStepUps } from "@/lib/career/server";
import { JobCard, JobList } from "@/components/JobCard";
import { StepUpGap } from "@/components/career/StepUpGap";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("jobStepUp");

const SHOWN = 40;
const PICK_LEVELS: Seniority[] = LADDER.filter((l) => l !== "INTERN" && l !== "MANAGER");
const PICK_ROLES = ["frontend", "backend", "fullstack", "mobile", "devops", "qa", "data", "ml"];
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function StepUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("/jobs/step-up");
  const [{ t, locale }, params] = await Promise.all([getDictionary(), searchParams]);
  const s = stepUpStrings(locale);
  const levelParam = one(params.level);
  const roleParam = one(params.role);
  const level = PICK_LEVELS.includes(levelParam as Seniority) ? (levelParam as Seniority) : undefined;
  const role = roleParam && PICK_ROLES.includes(roleParam) ? roleParam : undefined;
  const kindParam = one(params.kind);
  const kind = MOVE_KINDS.includes(kindParam as MoveKind) ? (kindParam as MoveKind) : undefined;
  const onlyApply = one(params.small) === "1";
  const { position, rows, counts } = await loadStepUps(user.id, { role, level });

  const href = (p: { level?: string; role?: string; kind?: string; small?: boolean }) => {
    const q = new URLSearchParams();
    const v = { level, role, kind, small: onlyApply, ...p };
    if (v.level) q.set("level", v.level);
    if (v.role) q.set("role", v.role);
    if (v.kind) q.set("kind", v.kind);
    if (v.small) q.set("small", "1");
    const qs = q.toString();
    return `/jobs/step-up${qs ? `?${qs}` : ""}`;
  };
  const roleName = (r: string) => (t.roles as Record<string, string>)[r] ?? r;
  const filtered = rows.filter((r) => (!kind || r.move.kind === kind) && (!onlyApply || r.gap.verdict === "apply"));
  const shown = filtered.slice(0, SHOWN);

  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-11 items-center rounded-full border px-3 text-sm sm:min-h-8",
      active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
    );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="rule-double pb-4">
        <Link
          href="/jobs"
          className="text-muted-foreground inline-flex min-h-11 items-center gap-1 text-sm hover:underline"
        >
          <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
          {s.backToJobs}
        </Link>
        <h1 className="text-title mt-1 font-black">{s.title}</h1>
        <p className="text-muted-foreground mt-2">{s.lead}</p>
      </header>

      {!position ? (
        <div className="bg-card rounded-lg border p-4" data-testid="stepup-no-profile">
          <p>{s.noProfile}</p>
          <Button asChild className="mt-3">
            <Link href="/profile">{s.toProfile}</Link>
          </Button>
        </div>
      ) : (
        <>
          <section className="bg-card flex flex-col gap-3 rounded-lg border p-4" data-testid="stepup-position">
            <p className="text-sm">
              <span className="text-muted-foreground">{s.youAre}</span>{" "}
              <strong data-testid="stepup-current">
                {roleName(position.role)} · {t.seniority[position.level]}
              </strong>{" "}
              <span className="text-muted-foreground text-xs">
                ({fillS(s.source[position.source], { years: position.years ?? "" })};{" "}
                {s.roleSource[position.roleSource]})
              </span>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">{s.nextStep}</span>{" "}
              <strong>
                {t.seniority[nextRung(position.level)]}
                {ROLE_UP[position.role]?.length ? ` · ${ROLE_UP[position.role].map(roleName).join(" / ")}` : ""}
              </strong>
            </p>
            <details className="text-sm">
              <summary className="text-primary min-h-11 cursor-pointer content-center font-medium sm:min-h-0">
                {s.notRight}
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                <p className="text-muted-foreground text-xs">{s.levelLabel}</p>
                <div className="flex flex-wrap gap-2" data-testid="stepup-levels">
                  {PICK_LEVELS.map((l) => (
                    <Link key={l} href={href({ level: l })} className={chip(position.level === l)}>
                      {t.seniority[l]}
                    </Link>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">{s.roleLabel}</p>
                <div className="flex flex-wrap gap-2" data-testid="stepup-roles">
                  {PICK_ROLES.map((r) => (
                    <Link key={r} href={href({ role: r })} className={chip(position.role === r)}>
                      {roleName(r)}
                    </Link>
                  ))}
                </div>
                {(level || role) && (
                  <Link href="/jobs/step-up" className="text-primary text-sm underline underline-offset-4">
                    {s.reset}
                  </Link>
                )}
              </div>
            </details>
          </section>

          <nav className="flex flex-wrap items-center gap-2" aria-label={s.title} data-testid="stepup-tabs">
            {(["all", ...MOVE_KINDS] as const).map((k) => (
              <Link
                key={k}
                href={href({ kind: k === "all" ? "" : k })}
                className={chip((kind ?? "all") === k)}
                aria-current={(kind ?? "all") === k ? "page" : undefined}
              >
                {s.tabs[k]} <span className="ms-1 font-mono text-xs opacity-80">{counts[k]}</span>
              </Link>
            ))}
            <Link href={href({ small: !onlyApply })} className={chip(onlyApply)} data-testid="stepup-small">
              {s.onlyApply} <span className="ms-1 font-mono text-xs opacity-80">{counts.apply}</span>
            </Link>
          </nav>

          <p className="text-muted-foreground text-sm" data-testid="stepup-count">
            {fillS(s.count, { n: filtered.length })}
            {filtered.length > SHOWN && ` · ${fillS(s.showing, { shown: SHOWN, total: filtered.length })}`}
          </p>

          {shown.length === 0 ? (
            <p className="bg-card rounded-lg border p-4" data-testid="stepup-empty">
              {kind === "technical"
                ? technicalTrackOpen(position.level)
                  ? s.emptyTechnical
                  : s.emptyTechnicalClosed
                : s.empty}
            </p>
          ) : (
            <JobList>
              {shown.map((r) => (
                <JobCard
                  key={r.job.id}
                  job={r.job}
                  t={t}
                  score={r.score || undefined}
                  why={
                    <StepUpGap move={r.move} gap={r.gap} position={position} jobRole={r.job.roleCategory} t={t} s={s} />
                  }
                />
              ))}
            </JobList>
          )}
          <p className="text-muted-foreground text-xs">{s.honest}</p>
        </>
      )}
    </div>
  );
}
