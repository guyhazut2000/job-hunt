export function MatchBadge({ score, label }: { score: number; label: string }) {
  const color =
    score >= 75
      ? "bg-emerald-100 text-emerald-800"
      : score >= 50
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-600";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}
      title={label}
    >
      {score}% <span className="font-normal">{label}</span>
    </span>
  );
}
