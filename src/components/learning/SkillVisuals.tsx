import Link from "next/link";
import {
  Brain,
  Briefcase,
  Check,
  Clock,
  Cloud,
  CodeXml,
  Container,
  Cpu,
  Database,
  FlaskConical,
  Layers,
  Loader,
  Monitor,
  Palette,
  Server,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import type { LearnCategory } from "@/lib/learning/types";
import { categoryTone, monogram } from "@/lib/learning/ui";
import { cn } from "@/lib/utils";

/**
 * Small presentational pieces shared by /learn, /learn/[skill] and the job page gap panel.
 * No hooks or server-only imports, so they render in both server and client components.
 */

export const CATEGORY_ICON: Record<LearnCategory, LucideIcon> = {
  foundations: Layers,
  languages: CodeXml,
  backend: Server,
  frontend: Monitor,
  mobile: Smartphone,
  data: Database,
  devops: Container,
  cloud: Cloud,
  ml: Brain,
  qa: FlaskConical,
  hardware: Cpu,
  design: Palette,
};

export type LearnStatus = "NONE" | "LEARNING" | "DONE";

/** Soft, category-tinted tile with the skill's monogram (decorative; the label is always next to it). */
export function SkillMonogram({
  label,
  category,
  size = "md",
  className,
}: {
  label: string;
  category: LearnCategory;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      dir="ltr"
      style={categoryTone(category)}
      className={cn(
        "grid shrink-0 place-items-center rounded-lg font-mono font-semibold tracking-tight [overflow-wrap:normal]",
        size === "sm" && "size-8 text-xs",
        size === "md" && "size-11 text-sm",
        size === "lg" && "size-16 text-xl sm:size-20 sm:text-2xl",
        className,
      )}
    >
      {monogram(label)}
    </span>
  );
}

/** SVG ring, 0..1. Decorative unless a label is given. */
export function ProgressRing({
  value,
  size = 28,
  stroke = 3,
  tone = "fit",
  label,
  children,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "fit" | "caution" | "primary";
  label?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--secondary)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`var(--${tone})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      {children && <span className="absolute inset-0 grid place-items-center">{children}</span>}
    </span>
  );
}

/** Status pill: nothing for NONE, amber for learning, green for done. Text always carries the meaning. */
export function StatusBadge({ status, label, className }: { status: LearnStatus; label: string; className?: string }) {
  if (status === "NONE") return null;
  const Icon = status === "DONE" ? Check : Loader;
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[0.72rem] font-semibold whitespace-nowrap",
        status === "DONE" ? "bg-fit-soft text-fit" : "bg-caution-soft text-caution",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

/** Rounded meta pill (hours, level, demand). */
export function MetaPill({
  icon: Icon,
  children,
  className,
  title,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "bg-card text-foreground/85 inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap",
        className,
      )}
    >
      {Icon && <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />}
      {children}
    </span>
  );
}

export interface SkillCardData {
  id: string;
  label: string;
  category: LearnCategory;
  categoryLabel: string;
  hours: number;
  demand: number;
  status: LearnStatus;
}

/** Grid card for one skill. The whole card is the link; badges and ring are secondary cues. */
export function SkillCard({
  skill,
  labels,
  footer,
}: {
  skill: SkillCardData;
  labels: { status: Record<LearnStatus, string>; hoursPill: string; demandPill: string };
  /** Optional extra line (e.g. "raises your match on 12 jobs"). */
  footer?: React.ReactNode;
}) {
  const fill = (k: string, n: number) => k.replace("{n}", String(n));
  return (
    <Link
      href={`/learn/${skill.id}`}
      className={cn(
        "group bg-card relative flex h-full min-w-0 flex-col gap-3 rounded-xl border p-4 shadow-[0_1px_0_var(--border)] transition-[border-color,box-shadow,transform] duration-200",
        "hover:border-foreground/25 hover:shadow-[0_6px_20px_-12px_oklch(0.21_0.014_60/0.35)] motion-safe:hover:-translate-y-0.5",
        skill.status === "DONE" && "border-fit/30",
      )}
    >
      <span className="flex items-start gap-3">
        <SkillMonogram label={skill.label} category={skill.category} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-base leading-snug font-semibold">
            <bdi dir="ltr">{skill.label}</bdi>
          </span>
          <span className="text-muted-foreground truncate text-xs">{skill.categoryLabel}</span>
        </span>
        {skill.status !== "NONE" && (
          <ProgressRing
            value={skill.status === "DONE" ? 1 : 0.5}
            size={26}
            tone={skill.status === "DONE" ? "fit" : "caution"}
          >
            {skill.status === "DONE" && <Check className="text-fit size-3" aria-hidden />}
          </ProgressRing>
        )}
      </span>
      <span className="text-muted-foreground mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5" aria-hidden />
          {fill(labels.hoursPill, skill.hours)}
        </span>
        {skill.demand > 0 && (
          <span className="inline-flex items-center gap-1">
            <Briefcase className="size-3.5" aria-hidden />
            {fill(labels.demandPill, skill.demand)}
          </span>
        )}
        <StatusBadge status={skill.status} label={labels.status[skill.status]} className="ms-auto" />
      </span>
      {footer}
    </Link>
  );
}
