import type { PrepStrings } from "@/lib/i18n/prep";
import type { DebriefStats as Stats } from "@/lib/prep/plan";

/** /stats section fed by post-interview debriefs (#93). Server component. */
export function DebriefStats({ s, st, stageLabel }: { s: PrepStrings; st: Stats; stageLabel: (k: string) => string }) {
  return (
    <section aria-labelledby="debrief-h" className="flex flex-col gap-3" data-testid="stats-debriefs">
      <h2 id="debrief-h" className="font-heading text-lg font-bold">
        {s.statsTitle}
      </h2>
      {st.total === 0 ? (
        <p className="text-muted-foreground card text-sm">{s.statsEmpty}</p>
      ) : (
        <div className="card flex flex-col gap-3">
          <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
            {[
              [s.statsTotal, st.total],
              [s.statsAvg, st.avgRating === null ? "—" : `${st.avgRating}/5`],
              [s.statsPassed, st.passed],
              [s.statsFailed, st.failed],
              [s.statsPending, st.pending],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-mono text-xl font-bold">{v}</dd>
              </div>
            ))}
          </dl>
          {st.byStage.length > 0 && (
            <div>
              <p className="text-sm font-semibold">{s.statsByStage}</p>
              <ul className="text-sm">
                {st.byStage.map((b) => (
                  <li key={b.kind}>
                    {stageLabel(b.kind)}: {b.count} · {b.avgRating}/5
                    {b.decided > 0 ? ` · ${s.statsPassed} ${b.passed}/${b.decided}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {st.improveNotes.length > 0 && (
            <div>
              <p className="text-sm font-semibold">{s.statsImprove}</p>
              <ul className="list-disc ps-5 text-sm">
                {st.improveNotes.map((n, i) => (
                  <li key={i} dir="auto">
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
