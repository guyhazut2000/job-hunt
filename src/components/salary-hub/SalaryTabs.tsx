import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SalaryHubStrings } from "@/lib/i18n/salary-hub";

const TABS = [
  ["explore", "/salary"],
  ["offers", "/salary/offers"],
  ["negotiate", "/salary/negotiate"],
] as const;

/** Header + tab links shared by the three /salary pages. */
export function SalaryHeader({
  s,
  active,
  title,
  lead,
}: {
  s: SalaryHubStrings;
  active: (typeof TABS)[number][0];
  title: string;
  lead: string;
}) {
  return (
    <header className="rule-double flex flex-col gap-3 pb-4">
      <div>
        <p className="kicker">{s.kicker}</p>
        <h1 className="text-title mt-1 font-black">{title}</h1>
        <p className="text-muted-foreground mt-2">{lead}</p>
      </div>
      <nav aria-label={s.title} className="flex flex-wrap gap-2">
        {TABS.map(([key, href]) => (
          <Link
            key={key}
            href={href}
            aria-current={active === key ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-semibold",
              active === key ? "bg-foreground text-background border-foreground" : "hover:bg-muted",
            )}
            data-testid={`salary-tab-${key}`}
          >
            {s.tabs[key]}
          </Link>
        ))}
      </nav>
    </header>
  );
}
