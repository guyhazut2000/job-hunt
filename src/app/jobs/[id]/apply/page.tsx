import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ExternalLink } from "lucide-react";
import { prepareApply } from "@/app/apply/actions";
import { DraftForm } from "@/components/auto-apply/DraftForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { documentStrings } from "@/lib/i18n/documents";
import { getLocale } from "@/lib/i18n";
import { autoApplyStrings, fillApply } from "@/lib/i18n/auto-apply";
import { localizedTitle } from "@/lib/i18n/titles";
import { hasValue } from "@/lib/auto-apply/types";
import { loadDraft } from "@/lib/auto-apply/server";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("applyDraft");

export default async function PrepareApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/jobs/${id}/apply`);
  const locale = await getLocale();
  const s = autoApplyStrings(locale);
  const loaded = await loadDraft(user.id, id);

  if (!loaded) {
    const job = await db.job.findUnique({ where: { id }, include: { company: { select: { name: true } } } });
    if (!job) notFound();
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Link
          href={`/jobs/${id}`}
          className="text-muted-foreground inline-flex min-h-11 items-center gap-1 text-sm font-semibold"
        >
          <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
          {s.backToJob}
        </Link>
        <h1 className="text-title font-black">{job.title}</h1>
        <p className="text-muted-foreground">{job.company.name}</p>
        <form action={prepareApply}>
          <input type="hidden" name="jobId" value={job.id} />
          <Button type="submit" data-testid="prepare-apply">
            {s.prepare}
          </Button>
        </form>
      </div>
    );
  }

  const { draft, fields, documents, docs, score, rules, settings } = loaded;
  const done = draft.status === "SUBMITTED" || draft.status === "HANDED_OFF";
  const manual = draft.status === "MANUAL";
  const needsConfirm = fields.some((f) => f.required && (f.flagged || !f.transmit));
  const answerNote =
    draft.answerSource === "ai"
      ? s.answerAi
      : draft.answerSource === "limited"
        ? s.answerLimited
        : draft.answerSource === "secret"
          ? s.answerSecret
          : draft.answerSource === "fallback"
            ? s.answerFallback
            : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="rule-double flex flex-col gap-2 pb-4">
        <Link
          href={`/jobs/${id}`}
          className="text-muted-foreground inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold"
        >
          <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
          {s.backToJob}
        </Link>
        <p className="kicker">{s.kicker}</p>
        <h1 className="text-title font-black">{draft.job.title}</h1>
        <p className="text-muted-foreground">{draft.job.company.name}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{s.status[draft.status]}</Badge>
          <Badge variant="secondary">{s.reasons[draft.reason as keyof typeof s.reasons] ?? draft.reason}</Badge>
          <span className="text-muted-foreground font-mono text-sm">
            {score == null ? s.noScore : fillApply(s.score, { n: score })}
          </span>
        </div>
      </header>

      {settings.fullyAutomatic && <p className="text-sm">{s.autoOn}</p>}
      {draft.reason === "linkedin" && <p className="text-sm leading-relaxed">{s.linkedin}</p>}
      {draft.reason === "email" && <p className="text-sm leading-relaxed">{s.email}</p>}
      {draft.reason === "unsupported" && <p className="text-sm leading-relaxed">{s.unsupported}</p>}
      {draft.platform === "lever" && <p className="text-sm leading-relaxed">{s.leverNote}</p>}
      {draft.formMode === "packet" && !manual && <p className="text-sm leading-relaxed">{s.packetNote}</p>}
      {draft.error === "cv" && <p className="text-sm">{s.cvBlocked}</p>}
      {draft.status === "FAILED" && (
        <p role="alert" className="text-sm">
          {s.failed}
          {draft.error ? ` (${draft.error})` : ""}
        </p>
      )}
      {answerNote && !manual && <p className="text-muted-foreground text-sm">{answerNote}</p>}

      {(manual || done) && (
        <p>
          <a
            href={draft.job.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex min-h-11 items-center gap-1 font-semibold underline"
          >
            {s.openForm}
            <ExternalLink className="size-4" aria-hidden />
          </a>
        </p>
      )}

      {done && (
        <section className="card flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold">{s.sentTitle}</h2>
          <p className="text-muted-foreground text-sm">{s.recorded}</p>
          <dl className="flex flex-col gap-2">
            {fields
              .filter((f) => f.kind !== "file" && hasValue(f))
              .map((f) => (
                <div key={f.id}>
                  <dt className="text-muted-foreground text-xs">{f.label}</dt>
                  <dd className="text-sm whitespace-pre-wrap" dir="auto">
                    {f.value}
                  </dd>
                </div>
              ))}
          </dl>
          <h3 className="text-sm font-semibold">{s.documents}</h3>
          {documents.length === 0 ? (
            <p className="text-muted-foreground text-sm">{s.noDocuments}</p>
          ) : (
            <ul className="text-sm">
              {documents.map((d) => (
                <li key={d.ref}>
                  {d.title} · <bdi>{d.fileName}</bdi>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!done && !manual && (
        <DraftForm
          s={s}
          docs={docs}
          docStrings={documentStrings(locale)}
          draftId={draft.id}
          fields={fields}
          initialRefs={documents.map((d) => d.ref)}
          blocks={rules.blocks}
          needsConfirm={needsConfirm}
          api={draft.delivery === "API" && draft.formMode === "ats"}
        />
      )}

      <Link href="/apply" className="text-primary w-fit text-sm font-semibold underline">
        {s.queueTitle}
      </Link>
    </div>
  );
}
