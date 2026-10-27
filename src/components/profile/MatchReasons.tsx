import { Check, Minus, X } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Reason } from "@/lib/profile/score";

const fill = (tpl: string, params?: Reason["params"]) =>
  tpl.replace(/\{(\w+)\}/g, (m, k: string) => (params && k in params ? String(params[k]) : m));

const ICON = { plus: Check, minus: X, neutral: Minus } as const;
const TONE = { plus: "text-fit", minus: "text-destructive", neutral: "text-muted-foreground" } as const;

export function MatchReasons({ t, reasons }: { t: Dictionary["match"]; reasons: Reason[] }) {
  if (!reasons.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold">{t.why}</h3>
      <ul className="flex flex-col gap-1.5 text-sm">
        {reasons.map((r, i) => {
          const Icon = ICON[r.tone];
          return (
            <li key={`${r.key}-${i}`} className="flex items-start gap-2">
              <Icon className={`mt-0.5 size-4 shrink-0 ${TONE[r.tone]}`} aria-hidden />
              <span>
                <span className="sr-only">{r.tone === "plus" ? "+" : r.tone === "minus" ? "−" : ""}</span>
                <bdi>{fill(t.reasons[r.key], r.params)}</bdi>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
