import Link from "next/link";
import { PageHead } from "@/components/problem-solving/PageHead";
import { SdSources } from "@/components/sysdesign/SdSources";
import { tr } from "@/lib/algo/types";
import { getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/learning";
import { systemDesignStrings } from "@/lib/i18n/system-design";
import { localizedTitle } from "@/lib/i18n/titles";
import { SD_CHEATSHEET, SD_FRONTEND_STEPS, SD_LATENCY, SD_METHOD } from "@/lib/sysdesign/content";

export const generateMetadata = localizedTitle("systemDesign");

/** System design method + cheat sheet (#118). Static, original content with cited sources. */
export default async function SystemDesignPage() {
  const locale = await getLocale();
  const t = systemDesignStrings(locale);
  return (
    <div className="flex flex-col gap-8" data-testid="sd-page">
      <PageHead kicker={t.kicker} title={t.title} lead={t.lead} />

      <section aria-labelledby="sd-method" className="flex flex-col gap-3">
        <h2 id="sd-method" className="text-xl font-black">
          {t.methodTitle}
        </h2>
        <ol className="grid gap-3 md:grid-cols-2" data-testid="sd-method">
          {SD_METHOD.map((st, i) => (
            <li key={st.id} className="bg-card flex min-w-0 flex-col gap-2 rounded-xl border p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-bold">
                  {i + 1}. {tr(st.title, locale)}
                </h3>
                <span className="bg-muted shrink-0 rounded-full px-2 py-0.5 font-mono text-xs">
                  {fmt(t.minutes, { m: st.minutes })}
                </span>
              </div>
              <p className="text-foreground/80 text-sm">{tr(st.goal, locale)}</p>
              <ul className="list-disc ps-5 text-sm">
                {st.checklist.map((c, k) => (
                  <li key={k}>{tr(c, locale)}</li>
                ))}
              </ul>
              <SdSources ids={st.sources} label={t.sources} />
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="sd-senior" className="bg-card flex flex-col gap-2 rounded-xl border p-4 sm:p-5">
        <h2 id="sd-senior" className="text-lg font-black">
          {t.seniorTitle}
        </h2>
        <ul className="list-disc ps-5 text-sm">
          {t.senior.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sd-frontend" className="flex flex-col gap-3">
        <h2 id="sd-frontend" className="text-xl font-black">
          {t.frontendTitle}
        </h2>
        <p className="text-foreground/80 max-w-[65ch] text-sm">{t.frontendLead}</p>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {SD_FRONTEND_STEPS.map((st) => (
            <li key={st.id} className="bg-card min-w-0 rounded-xl border p-3">
              <p className="font-bold" dir="ltr">
                {tr(st.title, locale)}
              </p>
              <p className="text-foreground/80 text-sm">{tr(st.body, locale)}</p>
            </li>
          ))}
        </ol>
        <SdSources ids={["radio", "vitals"]} label={t.sources} />
      </section>

      <section aria-labelledby="sd-cheat" className="flex flex-col gap-3">
        <h2 id="sd-cheat" className="text-xl font-black">
          {t.cheatTitle}
        </h2>
        <div className="grid gap-3 md:grid-cols-2" data-testid="sd-cheatsheet">
          {SD_CHEATSHEET.map((g) => (
            <section key={g.id} className="bg-card flex min-w-0 flex-col gap-2 rounded-xl border p-4">
              <h3 className="font-bold">{tr(g.title, locale)}</h3>
              <dl className="flex flex-col gap-1.5 text-sm">
                {g.items.map((it) => (
                  <div key={it.term}>
                    <dt className="font-semibold" dir="ltr">
                      {it.term}
                    </dt>
                    <dd className="text-foreground/80">{tr(it.note, locale)}</dd>
                  </div>
                ))}
              </dl>
              <SdSources ids={g.sources} label={t.sources} />
            </section>
          ))}
          <section className="bg-card flex min-w-0 flex-col gap-2 rounded-xl border p-4">
            <h3 className="font-bold">{t.latencyTitle}</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {SD_LATENCY.map((r, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-x-3">
                  <span>{tr(r.op, locale)}</span>
                  <bdi className="font-mono font-semibold">{r.value}</bdi>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-xs">{t.latencyNote}</p>
            <SdSources ids={["latency"]} label={t.sources} />
          </section>
        </div>
      </section>

      <section className="flex flex-col gap-1 text-sm">
        <SdSources ids={["roadmapSd", "primer", "ddia"]} label={t.roadmapLinks} />
        <p className="flex flex-wrap gap-3 pt-1">
          <Link href="/learn/system-design/questions" className="text-primary font-semibold underline">
            {t.qTitle}
          </Link>
          <Link href="/learn/system-design/ai" className="text-primary font-semibold underline">
            {t.aiTitle}
          </Link>
        </p>
      </section>
    </div>
  );
}
