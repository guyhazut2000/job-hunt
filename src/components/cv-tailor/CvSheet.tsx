import type { CvDoc, CvLanguage } from "@/lib/cv-tailor/types";
import { CV_HEADINGS } from "@/lib/i18n/cv-tailor";

function period(start: string, end: string, present: string): string {
  const f = (s: string) => {
    const [y, m] = s.split("-");
    return m ? `${m}/${y}` : y;
  };
  if (!start && !end) return "";
  return `${start ? f(start) : ""} – ${end ? f(end) : present}`;
}

/** The CV as it is printed / exported: one column, in the CV's own language and direction. */
export function CvSheet({ doc, language, highlight = [] }: { doc: CvDoc; language: CvLanguage; highlight?: string[] }) {
  const h = CV_HEADINGS[language];
  const hl = new Set(highlight.map((s) => s.toLowerCase()));
  return (
    <article
      lang={language}
      dir={language === "he" ? "rtl" : "ltr"}
      className="cv-sheet bg-card text-foreground flex flex-col gap-4 rounded-lg border p-5 text-[0.95rem] leading-relaxed sm:p-8"
      data-testid="cv-sheet"
    >
      <div className="border-foreground/70 flex flex-col gap-1 border-b-2 pb-3">
        {doc.name && <h1 className="font-heading text-2xl font-black">{doc.name}</h1>}
        {doc.headline && <p className="text-lg font-semibold">{doc.headline}</p>}
        {doc.contact.length > 0 && (
          <p className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
            {doc.contact.map((c) => (
              <span key={c} dir="ltr">
                {c}
              </span>
            ))}
          </p>
        )}
      </div>
      {doc.summary && (
        <section className="flex flex-col gap-1">
          <h2 className="text-primary text-sm font-bold tracking-wide uppercase">{h.summary}</h2>
          <p className="whitespace-pre-line">{doc.summary}</p>
        </section>
      )}
      {doc.experience.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-primary text-sm font-bold tracking-wide uppercase">{h.experience}</h2>
          {doc.experience.map((r) => (
            <div key={r.id} className="cv-role flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h3 className="font-bold">
                  {r.title} · {r.company}
                </h3>
                <span className="text-muted-foreground font-mono text-xs" dir="ltr">
                  {period(r.start, r.end, h.present)}
                </span>
              </div>
              {r.bullets.length > 0 && (
                <ul className="flex list-disc flex-col gap-0.5 ps-5">
                  {r.bullets.map((b, i) => (
                    <li key={i} dir="auto">
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}
      {doc.skills.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="text-primary text-sm font-bold tracking-wide uppercase">{h.skills}</h2>
          <p className="flex flex-wrap gap-1.5">
            {doc.skills.map((s) => (
              <span
                key={s}
                dir="ltr"
                className={
                  hl.has(s.toLowerCase())
                    ? "bg-fit-soft text-fit rounded px-1.5 font-semibold"
                    : "bg-muted rounded px-1.5"
                }
              >
                {s}
              </span>
            ))}
          </p>
        </section>
      )}
      {doc.education.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="text-primary text-sm font-bold tracking-wide uppercase">{h.education}</h2>
          <ul className="flex flex-col gap-0.5">
            {doc.education.map((e, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span>
                  {e.title ? `${e.title} · ` : ""}
                  {e.institution}
                </span>
                <span className="text-muted-foreground font-mono text-xs" dir="ltr">
                  {period(e.start, e.end, h.present)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {doc.languages.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="text-primary text-sm font-bold tracking-wide uppercase">{h.languages}</h2>
          <p>{doc.languages.join(" · ")}</p>
        </section>
      )}
    </article>
  );
}
