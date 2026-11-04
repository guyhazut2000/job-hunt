import Link from "next/link";
import { ExternalLink, UserRoundPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LinkedinWorkspace } from "@/components/linkedin/LinkedinWorkspace";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { linkedinProfileStrings } from "@/lib/i18n/linkedin-profile";
import { localizedTitle } from "@/lib/i18n/titles";
import { LINKEDIN_SOURCES, suggestAbout, suggestHeadline } from "@/lib/linkedin/profile";
import { loadLinkedinContext, loadLinkedinDraft } from "@/lib/linkedin/server";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("cvLinkedin");

/** LinkedIn profile workspace (#116): checks pasted profile text against rules and the CV; copy-only. */
export default async function LinkedinProfilePage() {
  const user = await requireUser("/cv/linkedin");
  const locale = await getLocale();
  const lang = locale === "en" ? "en" : "he";
  const s = linkedinProfileStrings(locale);
  const [ctx, draft, me] = await Promise.all([
    loadLinkedinContext(user.id),
    loadLinkedinDraft(user.id),
    db.user.findUnique({ where: { id: user.id }, select: { name: true } }),
  ]);
  const initialSuggestion =
    draft.suggestions && draft.suggestions.lang === lang
      ? { headline: draft.suggestions.headline, about: draft.suggestions.about, source: draft.aiSource === "ai" ? ("ai" as const) : ("template" as const) }
      : { headline: suggestHeadline(ctx, lang), about: suggestAbout(ctx, lang), source: "template" as const };

  return (
    <div className="flex flex-col gap-6" data-testid="linkedin-page">
      <header className="rule-double flex flex-col gap-2 pb-4">
        <p className="kicker">{s.kicker}</p>
        <h1 className="font-heading text-title flex items-center gap-2 font-black">
          <UserRoundPen className="text-primary size-7 shrink-0" aria-hidden />
          {s.title}
        </h1>
        <p className="text-muted-foreground max-w-3xl leading-relaxed">{s.lead}</p>
        <p className="bg-muted/50 w-fit rounded-md border px-3 py-1.5 text-sm font-medium" data-testid="li-no-auto">
          {s.noAuto}
        </p>
        <p className="text-muted-foreground text-xs">{s.approx}</p>
      </header>

      {ctx.empty && (
        <div className="bg-card flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm" data-testid="li-no-cv">
          <p>{s.noCv}</p>
          <Button asChild size="sm">
            <Link href="/profile">{s.noCvCta}</Link>
          </Button>
        </div>
      )}
      {!ctx.targetRoles.length && <p className="text-muted-foreground text-sm">{s.noRole}</p>}

      <LinkedinWorkspace
        s={s}
        lang={lang}
        ctx={{ cv: ctx.cv, targetRoles: ctx.targetRoles }}
        initial={draft.input}
        initialSuggestion={initialSuggestion}
        myName={me?.name ?? null}
      />

      <footer className="flex flex-col gap-2 border-t pt-4 text-sm">
        <h2 className="font-bold">{s.sources}</h2>
        <ul className="flex flex-col gap-1">
          {LINKEDIN_SOURCES.map((src) => (
            <li key={src.id}>
              <a href={src.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                <bdi dir="ltr">{src.label}</bdi>
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
        <h2 className="mt-2 font-bold">{s.related}</h2>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/cv/standard" className="underline underline-offset-2">{s.relCv}</Link>
          <Link href="/cv/ats" className="underline underline-offset-2">{s.relAts}</Link>
          <Link href="/outreach" className="underline underline-offset-2">{s.relOutreach}</Link>
        </p>
      </footer>
    </div>
  );
}
