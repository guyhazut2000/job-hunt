import { Check } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { computeCompleteness } from "@/lib/profile/completeness";

export function CompletenessMeter({
  t,
  result,
}: {
  t: Dictionary["pv2"];
  result: ReturnType<typeof computeCompleteness>;
}) {
  const { percent, missing } = result;
  const tone = percent >= 80 ? "text-fit" : percent >= 50 ? "text-caution" : "text-primary";
  return (
    <section aria-labelledby="completeness-h" className="bg-card flex flex-col gap-4 rounded-lg border p-4 sm:p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="completeness-h" className="kicker">
            {t.completeness}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">{t.completenessHint}</p>
        </div>
        <p className={`font-heading text-5xl leading-none font-black tabular-nums ${tone}`} dir="ltr">
          {percent}
          <span className="text-2xl">%</span>
        </p>
      </div>
      <Progress value={percent} aria-label={t.completeness} className="h-2" />
      {missing.length ? (
        <div>
          <h3 className="label">{t.missing}</h3>
          <ul className="flex flex-wrap gap-2">
            {missing.slice(0, 6).map((m) => (
              <li key={m.key}>
                <Link
                  href={`/profile?tab=${m.tab}`}
                  className="hover:border-primary hover:text-primary inline-flex min-h-11 items-center gap-1.5 rounded-md border border-dashed px-3 text-sm transition-colors"
                >
                  <span aria-hidden className="text-primary font-mono text-xs">
                    +{m.weight}
                  </span>
                  {t.items[m.key]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-fit flex items-center gap-2 text-sm font-semibold">
          <Check className="size-4" aria-hidden />
          {t.done}
        </p>
      )}
    </section>
  );
}
