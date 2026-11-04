import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { closingStrings, fillC } from "@/lib/i18n/closing";
import { localizedTitle } from "@/lib/i18n/titles";
import { parseScan } from "@/lib/closing/analysis";
import { canUndo, parseAcceptance, pickArchivable } from "@/lib/closing/archive";
import {
  CONTRACT_ITEMS,
  SOURCES,
  checklistProgress,
  parseChecklist,
  questionsText,
  questionsToAsk,
} from "@/lib/closing/checklist";
import { acceptThanksDraft, resignationLetterDraft, withdrawalDraft } from "@/lib/closing/drafts";
import { latestNoticeDate, noticePeriod, parseDay } from "@/lib/closing/notice";
import { parseTransition } from "@/lib/closing/transition";
import { loadOfferClosing } from "@/lib/closing/server";
import { requireUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/outreach/CopyButton";
import { AcceptOffer } from "@/components/closing/AcceptOffer";
import { OfferReply } from "@/components/closing/OfferReply";
import { offerReplyStrings } from "@/lib/i18n/offer-reply";
import { offerInputSchema } from "@/lib/offers/calc";
import { ChecklistItems } from "@/components/closing/ChecklistItems";
import { ContractScan } from "@/components/closing/ContractScan";
import { TransitionList } from "@/components/closing/TransitionList";
import {
  Disclaimer,
  DraftBox,
  PageHeader,
  fieldCls,
  fillBidi,
  fmtDay,
  fmtWhen,
  selectCls,
} from "@/components/closing/ui";
import { savePlan, saveNoticeInputs, undoAccept } from "../actions";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("closingOffer");

/** מהצעה לחוזה (#111): contract checklist, questions, optional text scan, transition plan, accept + undo. */
export default async function OfferClosingPage({ params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const user = await requireUser(`/closing/${offerId}`);
  const { locale } = await getDictionary();
  const s = closingStrings[locale];
  const loaded = await loadOfferClosing(user.id, offerId.slice(0, 64));
  if (!loaded) notFound();
  const { offer, closing } = loaded;
  const now = new Date();

  const checklist = parseChecklist(closing.checklist);
  const progress = checklistProgress(checklist);
  const questions = questionsToAsk(checklist, locale);
  const scan = parseScan(closing.analysis);
  const scanFound = Object.fromEntries((scan?.items ?? []).map((i) => [i.id, i.quote]));
  const t = parseTransition(closing.transition, locale);
  const acceptance = parseAcceptance(closing.acceptance);
  const accepted = !!offer.acceptedAt;

  const company = offer.application?.company ?? (offer.data as { company?: string } | null)?.company ?? offer.label;
  const role = offer.application?.title ?? "";

  const [me, openApps, archivedApps] = await Promise.all([
    db.user.findUnique({ where: { id: user.id }, select: { name: true } }),
    accepted
      ? Promise.resolve([])
      : db.application.findMany({
          where: { userId: user.id, archivedAt: null },
          select: { id: true, status: true, archivedAt: true, title: true, company: true },
          take: 300,
        }),
    accepted && acceptance?.archivedIds.length
      ? db.application.findMany({
          where: { userId: user.id, id: { in: acceptance.archivedIds } },
          select: { id: true, title: true, company: true },
        })
      : Promise.resolve([]),
  ]);
  const myName = me?.name ?? null;
  const willArchive = pickArchivable(openApps, offer.applicationId).map((a) => ({
    id: a.id,
    label: `${a.title} · ${a.company}`,
  }));

  // Notice period calculation (Israeli Prior Notice Law); only when the needed dates are filled.
  const start = parseDay(t.currentStart);
  const noticeDay = parseDay(t.noticeDate);
  const newStart = parseDay(t.newStart);
  const notice =
    start && noticeDay
      ? noticePeriod({ startDate: start, noticeDate: noticeDay, basis: t.payBasis, contractDays: t.contractNoticeDays })
      : null;
  const latest =
    start && newStart
      ? latestNoticeDate({ startDate: start, newStart, basis: t.payBasis, contractDays: t.contractNoticeDays })
      : undefined;
  const letter = resignationLetterDraft(
    {
      myName,
      managerName: t.manager || null,
      employer: t.employer || null,
      noticeDate: t.noticeDate ? fmtDay(t.noticeDate, locale) : locale === "he" ? "[תאריך]" : "[date]",
      lastDay: notice ? fmtDay(notice.endDate, locale) : locale === "he" ? "[היום האחרון]" : "[last day]",
    },
    locale,
  );

  const nav = [
    ["contract", s.oNav.contract],
    ["questions", s.oNav.questions],
    ["scan", s.oNav.scan],
    ["transition", s.oNav.transition],
    ["reply", s.oNav.reply],
    ["accept", s.oNav.accept],
  ] as const;
  const rs = offerReplyStrings(locale);
  const parsedOffer = offerInputSchema.safeParse(offer.data ?? {});

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader kicker={s.oTitle} title={company} lead={role || s.tLead} noAuto={s.noAuto} testId="offer-no-auto">
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <Link href="/closing" className="underline underline-offset-2">
            {s.back}
          </Link>
          <span className="text-muted-foreground">
            {fillC(s.checklistProgress, { done: progress.done, total: progress.total })}
            {progress.concern > 0 && ` · ${fillC(s.concerns, { n: progress.concern })}`}
          </span>
          {accepted && (
            <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-xs text-white">{s.acceptedBadge}</span>
          )}
        </div>
      </PageHeader>

      <nav aria-label={s.oTitle} className="-mt-2 flex flex-wrap gap-2 text-sm">
        {nav.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="hover:bg-muted rounded-full border px-3 py-1">
            {label}
          </a>
        ))}
      </nav>

      <Disclaimer text={s.disclaimer} />

      <section id="contract" className="flex scroll-mt-20 flex-col gap-3" aria-labelledby="contract-title">
        <h2 id="contract-title" className="font-heading text-lg font-bold">
          {s.cTitle}
        </h2>
        <p className="text-muted-foreground -mt-2 text-sm">{s.cLead}</p>
        <ChecklistItems
          s={s}
          lang={locale}
          offerId={offer.id}
          items={CONTRACT_ITEMS}
          state={checklist}
          scanFound={scanFound}
        />
      </section>

      <section
        id="questions"
        className="bg-card flex scroll-mt-20 flex-col gap-2 rounded-lg border p-4"
        aria-labelledby="q-title"
        data-testid="contract-questions"
      >
        <h2 id="q-title" className="font-heading text-lg font-bold">
          {s.qTitle}
        </h2>
        <p className="text-muted-foreground -mt-1 text-sm">{s.qLead}</p>
        {questions.length === 0 ? (
          <p className="text-sm">{s.qEmpty}</p>
        ) : (
          <>
            <ol className="list-decimal space-y-1 ps-5 text-sm">
              {questions.map((q) => (
                <li key={q.id} data-testid="contract-question">
                  {q.question}
                  {q.note && (
                    <span dir="auto" className="text-muted-foreground block text-xs">
                      {q.note}
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <div>
              <CopyButton text={questionsText(checklist, locale)} label={s.copy} copiedLabel={s.copied} />
            </div>
          </>
        )}
      </section>

      <section
        id="scan"
        className="bg-card flex scroll-mt-20 flex-col gap-2 rounded-lg border p-4"
        aria-labelledby="scan-title"
      >
        <h2 id="scan-title" className="font-heading text-lg font-bold">
          {s.sTitle}
        </h2>
        <p className="text-muted-foreground -mt-1 text-sm">{s.sLead}</p>
        <ContractScan s={s} lang={locale} offerId={offer.id} items={CONTRACT_ITEMS} last={scan} />
      </section>

      <section
        id="transition"
        className="flex scroll-mt-20 flex-col gap-4"
        aria-labelledby="t-title"
        data-testid="transition"
      >
        <div>
          <h2 id="t-title" className="font-heading text-lg font-bold">
            {s.tTitle}
          </h2>
          <p className="text-muted-foreground text-sm">{s.tLead}</p>
        </div>
        <form
          action={saveNoticeInputs}
          className="bg-card grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
          data-testid="notice-form"
        >
          <input type="hidden" name="offerId" value={offer.id} />
          <label className={fieldCls}>
            <span>{s.tCurrentStart}</span>
            <Input name="currentStart" type="date" defaultValue={t.currentStart} data-testid="notice-start" />
          </label>
          <label className={fieldCls}>
            <span>{s.tPayBasis}</span>
            <select name="payBasis" defaultValue={t.payBasis} className={selectCls}>
              <option value="monthly">{s.tMonthly}</option>
              <option value="hourly">{s.tHourly}</option>
            </select>
          </label>
          <label className={fieldCls}>
            <span>{s.tContractDays}</span>
            <Input
              name="contractNoticeDays"
              type="number"
              min={0}
              max={365}
              defaultValue={t.contractNoticeDays ?? ""}
            />
          </label>
          <label className={fieldCls}>
            <span>{s.tNoticeDate}</span>
            <Input name="noticeDate" type="date" defaultValue={t.noticeDate} data-testid="notice-date" />
          </label>
          <label className={fieldCls}>
            <span>{s.tNewStart}</span>
            <Input name="newStart" type="date" defaultValue={t.newStart} data-testid="notice-new-start" />
          </label>
          <label className={fieldCls}>
            <span>{s.tEmployer}</span>
            <Input name="employer" maxLength={120} dir="auto" defaultValue={t.employer} />
          </label>
          <label className={fieldCls}>
            <span>{s.tManager}</span>
            <Input name="manager" maxLength={120} dir="auto" defaultValue={t.manager} />
          </label>
          <div className="flex items-end">
            <Button type="submit" data-testid="notice-calc">
              {s.tCalc}
            </Button>
          </div>
        </form>

        <div className="bg-muted/30 flex flex-col gap-1 rounded-lg border p-4 text-sm" data-testid="notice-result">
          {notice ? (
            <>
              <p>{fillC(s.tResultMonths, { n: notice.months })}</p>
              <p className="font-medium">
                {notice.legal.kind === "month"
                  ? s.tResultLegalMonth
                  : fillC(s.tResultLegalDays, { days: Number(notice.legal.days.toFixed(1)) })}
              </p>
              {notice.basis === "contract" && notice.contractDays && (
                <p>{fillC(s.tResultContract, { days: notice.contractDays })}</p>
              )}
              <p className="font-semibold" data-testid="notice-last-day">
                {fillC(s.tLastDay, { date: fmtDay(notice.endDate, locale) })}
              </p>
              {newStart && notice.endDate >= t.newStart && (
                <p className="text-destructive">{fillC(s.tOverlap, { last: fmtDay(notice.endDate, locale) })}</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">{s.tNeedDates}</p>
          )}
          {latest !== undefined &&
            (latest ? (
              <p data-testid="notice-latest">
                {fillC(s.tLatest, { start: fmtDay(t.newStart, locale), date: fmtDay(latest, locale) })}
              </p>
            ) : (
              <p className="text-amber-700">{s.tLatestNone}</p>
            ))}
          <p className="text-muted-foreground mt-2 text-xs">{s.tNoticeFacts}</p>
          <p className="flex flex-wrap gap-x-3 text-xs">
            {[SOURCES.noticeLaw, SOURCES.noticeKz, SOURCES.unemployment].map((src) => (
              <a key={src.url} href={src.url} target="_blank" rel="noopener noreferrer" className="underline">
                <bdi>{src.label[locale]}</bdi>
              </a>
            ))}
          </p>
        </div>

        <DraftBox title={s.tLetter} text={letter} copy={s.copy} copied={s.copied} testId="draft-resignation" />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-card flex flex-col gap-2 rounded-lg border p-4">
            <h3 className="font-heading font-bold">{s.tHandover}</h3>
            <TransitionList s={s} offerId={offer.id} list="handover" items={t.handover} />
          </div>
          <div className="bg-card flex flex-col gap-2 rounded-lg border p-4">
            <h3 className="font-heading font-bold">{s.tFirstDay}</h3>
            <TransitionList s={s} offerId={offer.id} list="firstDay" items={t.firstDay} />
          </div>
        </div>

        <form action={savePlan} className="bg-card flex flex-col gap-3 rounded-lg border p-4" data-testid="plan-form">
          <h3 className="font-heading font-bold">{s.tPlan}</h3>
          <input type="hidden" name="offerId" value={offer.id} />
          {(
            [
              ["d30", s.tD30],
              ["d60", s.tD60],
              ["d90", s.tD90],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className={fieldCls}>
              <span className="font-medium">{label}</span>
              <textarea
                name={k}
                dir="auto"
                rows={4}
                maxLength={3000}
                defaultValue={t.plan[k]}
                className="bg-background w-full rounded-md border p-2 text-sm"
              />
            </label>
          ))}
          <div>
            <Button type="submit" variant="secondary" data-testid="plan-save">
              {s.save}
            </Button>
          </div>
        </form>
      </section>

      <section
        id="reply"
        className="bg-card flex scroll-mt-20 flex-col gap-3 rounded-lg border p-4"
        aria-labelledby="reply-title"
        data-testid="offer-reply"
      >
        <h2 id="reply-title" className="font-heading text-lg font-bold">
          {rs.title}
        </h2>
        <p className="text-muted-foreground -mt-1 text-sm">{rs.lead}</p>
        <OfferReply
          s={rs}
          lang={locale === "en" ? "en" : "he"}
          company={company}
          role={role}
          myName={myName}
          offer={parsedOffer.success ? parsedOffer.data : null}
        />
      </section>

      <section
        id="accept"
        className="bg-card flex scroll-mt-20 flex-col gap-3 rounded-lg border-2 p-4"
        aria-labelledby="acc-title"
        data-testid="accept"
      >
        <h2 id="acc-title" className="font-heading text-lg font-bold">
          {s.accTitle}
        </h2>
        {accepted && acceptance ? (
          <div className="flex flex-col gap-3" data-testid="accept-done">
            <p className="font-medium text-emerald-700">
              {fillC(s.accDone, { when: fmtWhen(acceptance.acceptedAt, locale) })}
            </p>
            {acceptance.archivedIds.length > 0 && (
              <p className="text-sm">{fillC(s.accArchived, { n: acceptance.archivedIds.length })}</p>
            )}
            {(acceptance.paused.highMatchWas || acceptance.paused.savedSearchIds.length > 0) && (
              <p className="text-sm">{s.accPaused}</p>
            )}
            {canUndo(acceptance, now) && (
              <form action={undoAccept}>
                <input type="hidden" name="offerId" value={offer.id} />
                <Button type="submit" variant="outline" size="sm" data-testid="accept-undo">
                  {s.accUndo}
                </Button>
              </form>
            )}
            <h3 className="font-heading mt-2 font-bold">{s.accDrafts}</h3>
            <DraftBox
              title={fillBidi(s.accThanksTo, { company })}
              text={acceptThanksDraft({ company, role, myName }, locale)}
              copy={s.copy}
              copied={s.copied}
              testId="draft-accept-thanks"
            />
            {archivedApps.map((a) => (
              <DraftBox
                key={a.id}
                title={fillBidi(s.accWithdrawTo, { company: a.company })}
                text={withdrawalDraft({ company: a.company, role: a.title, myName }, locale)}
                copy={s.copy}
                copied={s.copied}
                testId="draft-withdraw"
              />
            ))}
          </div>
        ) : (
          <>
            {acceptance?.undoneAt && <p className="text-muted-foreground text-sm">{s.accUndone}</p>}
            <p className="text-muted-foreground text-sm">{s.accLead}</p>
            <AcceptOffer s={s} offerId={offer.id} willArchive={willArchive} />
          </>
        )}
      </section>
    </div>
  );
}
