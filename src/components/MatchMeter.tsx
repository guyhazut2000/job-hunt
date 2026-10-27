import { Percent } from "./Percent";
import { cn } from "@/lib/utils";

export function matchTone(score: number) {
  return score >= 75 ? "fit" : score >= 50 ? "caution" : "muted";
}

/** Circular score dial. Colour carries meaning, but the number + label always carry it too. */
export function MatchMeter({ score, label, size = "md" }: { score: number; label: string; size?: "md" | "lg" }) {
  const tone = matchTone(score);
  const color = tone === "fit" ? "var(--fit)" : tone === "caution" ? "var(--caution)" : "var(--muted-foreground)";
  return (
    <div
      role="img"
      aria-label={`${label}: ${score}%`}
      className={cn("flex flex-col items-center gap-1", size === "lg" && "gap-1.5")}
    >
      <div
        className={cn("grid place-items-center rounded-full", size === "lg" ? "size-20 p-1.5" : "size-13 p-1")}
        style={{ background: `conic-gradient(${color} ${score * 3.6}deg, var(--secondary) 0)` }}
      >
        <div style={{ color }} className="bg-card grid size-full place-items-center rounded-full">
          <Percent
            value={score}
            showSign={false}
            className={cn("font-mono leading-none font-medium", size === "lg" ? "text-xl" : "text-[0.8rem]")}
          />
        </div>
      </div>
      <span className="kicker text-[0.62rem]">{label}</span>
    </div>
  );
}
