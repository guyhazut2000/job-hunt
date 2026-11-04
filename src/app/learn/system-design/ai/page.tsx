import { PageHead } from "@/components/problem-solving/PageHead";
import { SdSources } from "@/components/sysdesign/SdSources";
import { tr } from "@/lib/algo/types";
import { getLocale } from "@/lib/i18n";
import { systemDesignStrings } from "@/lib/i18n/system-design";
import { localizedTitle } from "@/lib/i18n/titles";
import { SD_AI_TOPICS } from "@/lib/sysdesign/content";

export const generateMetadata = localizedTitle("sdAi");

export default async function SystemDesignAiPage() {
  const locale = await getLocale();
  const t = systemDesignStrings(locale);
  return (
    <div className="flex flex-col gap-6" data-testid="sd-ai-page">
      <PageHead kicker={t.kicker} title={t.aiTitle} lead={t.aiLead} />
      <ol className="grid gap-3 md:grid-cols-2" data-testid="sd-ai-topics">
        {SD_AI_TOPICS.map((a, i) => (
          <li key={a.id} id={a.id} className="bg-card flex min-w-0 flex-col gap-2 rounded-xl border p-4">
            <h2 className="font-bold">
              {i + 1}. {tr(a.title, locale)}
            </h2>
            <p className="text-foreground/80 text-sm">
              <span className="font-semibold">{t.why}: </span>
              {tr(a.why, locale)}
            </p>
            <ul className="list-disc ps-5 text-sm">
              {a.points.map((p, k) => (
                <li key={k}>{tr(p, locale)}</li>
              ))}
            </ul>
            <p className="bg-muted rounded-md p-2 text-sm">
              <span className="font-semibold">{t.ask}: </span>
              {tr(a.ask, locale)}
            </p>
            <SdSources ids={a.sources} label={t.sources} />
          </li>
        ))}
      </ol>
      <section className="bg-card flex flex-col gap-1 rounded-xl border p-4 text-sm">
        <h2 className="font-bold">{t.inThisApp}</h2>
        <p className="text-foreground/80">{t.inThisAppBody}</p>
      </section>
      <SdSources ids={["roadmapAi"]} label={t.roadmapLinks} />
    </div>
  );
}
