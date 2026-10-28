import Link from "next/link";
import {
  BrainCircuit,
  BriefcaseBusiness,
  ChartColumn,
  CircleHelp,
  Cloud,
  CodeXml,
  Cpu,
  Database,
  Headset,
  Infinity as InfinityIcon,
  Kanban,
  Layers,
  LayoutTemplate,
  type LucideIcon,
  Megaphone,
  Microchip,
  MonitorCog,
  Package,
  Palette,
  Server,
  ShieldCheck,
  Smartphone,
  TestTubeDiagonal,
} from "lucide-react";
import {
  DOMAIN_COLORS,
  DOMAIN_LABELS,
  DOMAIN_STRINGS,
  domainHref,
  isJobDomain,
  type JobDomain,
} from "@/lib/jobs/domains";
import { cn } from "@/lib/utils";

export const DOMAIN_ICONS: Record<JobDomain, LucideIcon> = {
  backend: Server,
  frontend: LayoutTemplate,
  fullstack: Layers,
  mobile: Smartphone,
  software: CodeXml,
  devops: InfinityIcon,
  cloud: Cloud,
  "data-eng": Database,
  "data-science": BrainCircuit,
  analytics: ChartColumn,
  qa: TestTubeDiagonal,
  security: ShieldCheck,
  embedded: Cpu,
  hardware: Microchip,
  it: MonitorCog,
  product: Package,
  design: Palette,
  project: Kanban,
  support: Headset,
  sales: Megaphone,
  "business-ops": BriefcaseBusiness,
  other: CircleHelp,
};

/**
 * The job's domain (תחום) as a small coloured badge. Clicking it applies the domain filter.
 * Sits above a card's full-size link overlay (`relative z-10`) and truncates instead of overflowing.
 */
export function DomainBadge({
  domain,
  locale,
  href,
  size = "md",
  className,
}: {
  domain: string | null | undefined;
  locale: "en" | "he";
  /** Defaults to `/jobs?domain=…`; pass one to keep other filters. */
  href?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const d: JobDomain = isJobDomain(domain) ? domain : "other";
  const label = DOMAIN_LABELS[locale][d];
  const s = DOMAIN_STRINGS[locale];
  const Icon = DOMAIN_ICONS[d];
  return (
    <Link
      href={href ?? domainHref(d)}
      title={`${s.field}: ${label} · ${s.auto}`}
      aria-label={`${s.field}: ${label} (${s.auto}) – ${s.filter}`}
      data-testid="domain-badge"
      data-domain={d}
      className={cn(
        "relative z-10 inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border font-semibold whitespace-nowrap transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
        size === "sm" ? "h-5 px-1.5 text-[0.7rem]" : "min-h-6 px-2 py-0.5 text-xs",
        DOMAIN_COLORS[d],
        className,
      )}
    >
      <Icon className={cn("shrink-0", size === "sm" ? "size-3" : "size-3.5")} aria-hidden />
      <span className="min-w-0 truncate" dir="auto">
        {label}
      </span>
    </Link>
  );
}
