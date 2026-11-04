import Link from "next/link";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { closingStrings, type ClosingStrings } from "@/lib/i18n/closing";
import { localizedTitle } from "@/lib/i18n/titles";
import { CONSENT, needsBrief, needsThanks } from "@/lib/closing/referees";
import { refereeBriefDraft, refereeRequestDraft, refereeThanksDraft } from "@/lib/closing/drafts";
import { requireUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DraftBox, PageHeader, fieldCls, fmtWhen, selectCls } from "@/components/closing/ui";
import { cn } from "@/lib/utils";
import { deleteReferee, linkReferee, markRefereeLink, saveReferee, unlinkReferee } from "../actions";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("closingReferences");

type RefRow = {
  id: string;
  name: string;
  relation: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  fitsRoles: string[];
  consent: string;
  lastContactedAt: Date | null;
  notes: string | null;
};

/** ממליצים (#111): referees, consent, per-application brief/thank reminders, copy-only drafts. */
export default async function ReferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string }>;
}) {
  const user = await requireUser("/closing/references");
  const [{ locale }, sp] = await Promise.all([getDictionary(), searchParams]);
  const s = closingStrings[locale];
  const now = new Date();

  const [me, referees, apps] = await Promise.all([
    db.user.findUnique({ where: { id: user.id }, select: { name: true } }),
    db.referee.findMany({
      where: { userId: user.id },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        links: {
          orderBy: { createdAt: "desc" },
          include: { application: { select: { id: true, title: true, company: true, archivedAt: true } } },
        },
      },
      take: 50,
    }),
    db.application.findMany({
      where: { userId: user.id, archivedAt: null, status: { notIn: ["REJECTED", "SAVED"] } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, company: true },
      take: 100,
    }),
  ]);
  const myName = me?.name ?? null;
  const editing = sp.edit ? referees.find((r) => r.id === sp.edit) : undefined;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader kicker={s.kicker} title={s.rTitle} lead={s.rLead} noAuto={s.noAuto} testId="references-no-auto">
        <Link href="/closing" className="mt-3 inline-block text-sm underline underline-offset-2">
          {s.back}
        </Link>
      </PageHeader>

      <section aria-label={s.rTitle} data-testid="referees-list">
        {referees.length === 0 ? (
          <p className="text-muted-foreground text-sm">{s.rEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {referees.map((r) => {
              const firstApp = r.links[0]?.application ?? apps[0];
              return (
                <li key={r.id} className="bg-card flex flex-col gap-2 rounded-lg border p-3" data-testid="referee-row">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        <bdi>{r.name}</bdi>
                        {r.relation && (
                          <span className="text-muted-foreground">
                            {" "}
                            · <bdi>{r.relation}</bdi>
                          </span>
                        )}
                        {r.company && (
                          <span className="text-muted-foreground">
                            {" "}
                            · <bdi>{r.company}</bdi>
                          </span>
                        )}
                      </p>
                      <p className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
                        {r.email && (
                          <a href={`mailto:${r.email}`} dir="ltr" className="underline">
                            {r.email}
                          </a>
                        )}
                        {r.phone && (
                          <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} dir="ltr" className="underline">
                            {r.phone}
                          </a>
                        )}
                        {r.linkedinUrl && (
                          <a href={r.linkedinUrl} target="_blank" rel="noopener noreferrer" className="underline">
                            LinkedIn
                          </a>
                        )}
                        {r.lastContactedAt && (
                          <span>
                            {s.rLastContact}: {fmtWhen(r.lastContactedAt, locale, false)}
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs",
                        r.consent === "AGREED"
                          ? "bg-emerald-700 text-white"
                          : r.consent === "DECLINED"
                            ? "bg-destructive text-white"
                            : "bg-muted",
                      )}
                      data-testid="referee-consent"
                    >
                      {s.rConsents[r.consent as keyof ClosingStrings["rConsents"]] ?? r.consent}
                    </span>
                  </div>
                  {r.fitsRoles.length > 0 && (
                    <ul className="flex flex-wrap gap-1">
                      {r.fitsRoles.map((t) => (
                        <li key={t} className="bg-muted rounded px-1.5 py-0.5 text-xs">
                          <bdi>{t}</bdi>
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.notes && (
                    <p dir="auto" className="text-sm whitespace-pre-line">
                      {r.notes}
                    </p>
                  )}

                  {r.links.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm font-semibold">{s.rLinks}</p>
                      <ul className="flex flex-col gap-2">
                        {r.links.map((l) => {
                          const brief = needsBrief(l, now);
                          const thanks = needsThanks(l, now);
                          const role = l.application.title;
                          const company = l.application.company;
                          return (
                            <li
                              key={l.id}
                              className="flex flex-col gap-1 rounded-md border p-2"
                              data-testid="referee-link"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <bdi className="min-w-0 font-medium">
                                  {role} · {company}
                                </bdi>
                                {l.expectedCallAt && (
                                  <span className="text-xs">
                                    {s.rExpected}: {fmtWhen(l.expectedCallAt, locale)}
                                  </span>
                                )}
                              </div>
                              {brief && (
                                <p className="text-xs font-medium text-amber-700" data-testid="referee-needs-brief">
                                  {s.rNeedsBrief}
                                </p>
                              )}
                              {thanks && <p className="text-xs font-medium text-amber-700">{s.rNeedsThanks}</p>}
                              <div className="flex flex-wrap items-center gap-2">
                                {(
                                  [
                                    ["briefedAt", s.rBriefed],
                                    ["calledAt", s.rCalled],
                                    ["thankedAt", s.rThanked],
                                  ] as const
                                ).map(([field, label]) => {
                                  const on = !!l[field];
                                  return (
                                    <form key={field} action={markRefereeLink}>
                                      <input type="hidden" name="linkId" value={l.id} />
                                      <input type="hidden" name="field" value={field} />
                                      <input type="hidden" name="on" value={on ? "0" : "1"} />
                                      <button
                                        type="submit"
                                        aria-pressed={on}
                                        className={cn(
                                          "rounded-full border px-2 py-0.5 text-xs",
                                          on ? "border-emerald-700 bg-emerald-700 text-white" : "hover:bg-muted",
                                        )}
                                        data-testid={`referee-mark-${field}`}
                                      >
                                        {on ? "✓ " : ""}
                                        {label}
                                      </button>
                                    </form>
                                  );
                                })}
                                <form action={unlinkReferee}>
                                  <input type="hidden" name="linkId" value={l.id} />
                                  <button type="submit" className="text-muted-foreground text-xs underline">
                                    {s.rUnlink}
                                  </button>
                                </form>
                              </div>
                              <DraftBox
                                title={s.rDraftBrief}
                                text={refereeBriefDraft(
                                  {
                                    refereeName: r.name,
                                    myName,
                                    role,
                                    company,
                                    when: l.expectedCallAt ? fmtWhen(l.expectedCallAt, locale) : null,
                                  },
                                  locale,
                                )}
                                copy={s.copy}
                                copied={s.copied}
                                testId="draft-brief"
                              />
                              {(l.calledAt || thanks) && (
                                <DraftBox
                                  title={s.rDraftThanks}
                                  text={refereeThanksDraft({ refereeName: r.name, myName, company }, locale)}
                                  copy={s.copy}
                                  copied={s.copied}
                                />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {r.consent !== "AGREED" && r.consent !== "DECLINED" && (
                    <DraftBox
                      title={s.rDraftRequest}
                      text={refereeRequestDraft(
                        { refereeName: r.name, myName, role: firstApp?.title, company: firstApp?.company },
                        locale,
                      )}
                      copy={s.copy}
                      copied={s.copied}
                      testId="draft-request"
                    />
                  )}

                  {apps.length > 0 && (
                    <form
                      action={linkReferee}
                      className="flex flex-wrap items-end gap-2"
                      data-testid="referee-link-form"
                    >
                      <input type="hidden" name="refereeId" value={r.id} />
                      <label className={cn(fieldCls, "min-w-40 flex-1")}>
                        <span className="text-xs">{s.rLinkAdd}</span>
                        <select name="applicationId" required className={selectCls} defaultValue="">
                          <option value="" disabled>
                            {s.aPickApp}
                          </option>
                          {apps.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.title} · {a.company}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={cn(fieldCls, "min-w-40")}>
                        <span className="text-xs">{s.rExpected}</span>
                        <Input name="expectedCallAt" type="datetime-local" className="h-9" />
                      </label>
                      <Button type="submit" size="sm" variant="secondary">
                        {s.add}
                      </Button>
                    </form>
                  )}

                  <div className="flex gap-3 text-sm">
                    <Link href={`/closing/references?edit=${r.id}#referee-form`} className="underline">
                      {s.edit}
                    </Link>
                    <form action={deleteReferee}>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className="text-destructive underline">
                        {s.remove}
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section
        id="referee-form"
        className="bg-card flex flex-col gap-3 rounded-lg border p-4"
        aria-labelledby="referee-form-title"
      >
        <h2 id="referee-form-title" className="font-heading text-lg font-bold">
          {editing ? `${s.edit}: ${editing.name}` : s.rAdd}
        </h2>
        {sp.error && (
          <p className="text-destructive text-sm" role="alert">
            {s.error}
          </p>
        )}
        <RefereeForm key={editing?.id ?? "new"} s={s} row={editing} />
      </section>
    </div>
  );
}

function RefereeForm({ s, row }: { s: ClosingStrings; row?: RefRow }) {
  return (
    <form action={saveReferee} className="grid gap-3 sm:grid-cols-2" data-testid="referee-form">
      {row && <input type="hidden" name="id" value={row.id} />}
      <label className={fieldCls}>
        <span>{s.rName}</span>
        <Input
          name="name"
          required
          maxLength={120}
          dir="auto"
          defaultValue={row?.name ?? ""}
          data-testid="referee-name"
        />
      </label>
      <label className={fieldCls}>
        <span>{s.rRelation}</span>
        <Input name="relation" maxLength={120} dir="auto" defaultValue={row?.relation ?? ""} />
      </label>
      <label className={fieldCls}>
        <span>{s.rCompany}</span>
        <Input name="company" maxLength={120} dir="auto" defaultValue={row?.company ?? ""} />
      </label>
      <label className={fieldCls}>
        <span>{s.rConsent}</span>
        <select
          name="consent"
          defaultValue={row?.consent ?? "NOT_ASKED"}
          className={selectCls}
          data-testid="referee-consent-input"
        >
          {CONSENT.map((c) => (
            <option key={c} value={c}>
              {s.rConsents[c]}
            </option>
          ))}
        </select>
      </label>
      <label className={fieldCls}>
        <span>{s.rEmail}</span>
        <Input name="email" type="email" maxLength={200} dir="ltr" defaultValue={row?.email ?? ""} />
      </label>
      <label className={fieldCls}>
        <span>{s.rPhone}</span>
        <Input name="phone" type="tel" maxLength={40} dir="ltr" defaultValue={row?.phone ?? ""} />
      </label>
      <label className={fieldCls}>
        <span>{s.rLinkedin}</span>
        <Input name="linkedinUrl" type="url" maxLength={300} dir="ltr" defaultValue={row?.linkedinUrl ?? ""} />
      </label>
      <label className={fieldCls}>
        <span>{s.rLastContact}</span>
        <Input
          name="lastContactedAt"
          type="date"
          defaultValue={row?.lastContactedAt ? row.lastContactedAt.toISOString().slice(0, 10) : ""}
        />
      </label>
      <label className={cn(fieldCls, "sm:col-span-2")}>
        <span>{s.rFits}</span>
        <Input name="fitsRoles" maxLength={500} dir="auto" defaultValue={row?.fitsRoles.join(", ") ?? ""} />
      </label>
      <label className={cn(fieldCls, "sm:col-span-2")}>
        <span>{s.rNotes}</span>
        <textarea
          name="notes"
          rows={2}
          maxLength={2000}
          dir="auto"
          defaultValue={row?.notes ?? ""}
          className="bg-background w-full rounded-md border p-2 text-sm"
        />
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" data-testid="referee-save">
          {s.save}
        </Button>
        {row && (
          <Button asChild variant="ghost">
            <Link href="/closing/references">{s.cancel}</Link>
          </Button>
        )}
      </div>
    </form>
  );
}
