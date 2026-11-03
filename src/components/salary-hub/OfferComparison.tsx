"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { deleteOffer, saveOffer } from "@/app/salary/hub-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import { bestBy, computeOffer, EMPTY_OFFER, type OfferInput, type OfferResult } from "@/lib/offers/calc";
import { DEFAULT_CREDIT_POINTS } from "@/lib/offers/tax";
import { fill, type SalaryHubStrings } from "@/lib/i18n/salary-hub";
import { cn } from "@/lib/utils";

export interface OfferDraft {
  key: string;
  id: string | null;
  applicationId: string | null;
  data: OfferInput;
}

type NumKey = {
  [K in keyof OfferInput]: OfferInput[K] extends number ? K : never;
}[keyof OfferInput];

const GROUPS: { key: keyof SalaryHubStrings["offers"]["groups"]; fields: NumKey[] }[] = [
  { key: "cash", fields: ["baseMonthly", "bonusAnnual", "signingBonus"] },
  {
    key: "equity",
    fields: ["equityUnits", "equityStrike", "equitySharePrice", "equityFx", "vestingYears", "equityHaircutPct"],
  },
  {
    key: "social",
    fields: ["pensionEmployerPct", "severancePct", "pensionEmployeePct", "khEmployerPct", "khEmployeePct"],
  },
  { key: "perks", fields: ["carBenefitMonthly", "carSavingsMonthly", "travelMonthly", "mealsMonthly", "otherMonthly"] },
  { key: "work", fields: ["remoteDaysPerWeek", "commuteMinutesOneWay", "commuteCostMonthly"] },
];

const MAX = 3;
let seq = 0;
const newKey = () => `n${++seq}`;

export function OfferComparison({
  initial,
  apps,
  signedIn,
  s,
  locale,
}: {
  initial: OfferDraft[];
  apps: { id: string; label: string }[];
  signedIn: boolean;
  s: SalaryHubStrings["offers"];
  locale: string;
}) {
  const [offers, setOffers] = useState<OfferDraft[]>(
    initial.length
      ? initial.slice(0, MAX)
      : [{ key: newKey(), id: null, applicationId: null, data: { ...EMPTY_OFFER } }],
  );
  const [points, setPoints] = useState(DEFAULT_CREDIT_POINTS);
  const [status, setStatus] = useState<Record<string, "saved" | "error" | undefined>>({});
  const [pending, start] = useTransition();
  const nf = useMemo(() => new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-GB"), [locale]);
  const ils = (n: number) => `₪${nf.format(n)}`;

  const results = offers.map((o) => computeOffer(o.data, { creditPoints: points }));
  const best = {
    total: bestBy(results, (r) => r.annual.total),
    net: bestBy(results, (r) => r.monthly.netValue),
  };

  const update = (key: string, patch: Partial<OfferInput>, meta?: Partial<OfferDraft>) => {
    setOffers((os) => os.map((o) => (o.key === key ? { ...o, ...meta, data: { ...o.data, ...patch } } : o)));
    setStatus((st) => ({ ...st, [key]: undefined }));
  };

  const save = (o: OfferDraft) =>
    start(async () => {
      const r = await saveOffer({ id: o.id, applicationId: o.applicationId, data: o.data });
      if (r.ok) setOffers((os) => os.map((x) => (x.key === o.key ? { ...x, id: r.id } : x)));
      setStatus((st) => ({ ...st, [o.key]: r.ok ? "saved" : "error" }));
    });

  const remove = (o: OfferDraft) =>
    start(async () => {
      if (o.id) await deleteOffer(o.id);
      setOffers((os) => {
        const next = os.filter((x) => x.key !== o.key);
        return next.length ? next : [{ key: newKey(), id: null, applicationId: null, data: { ...EMPTY_OFFER } }];
      });
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {s.creditPoints}
          <Input
            type="number"
            step="0.25"
            min={0}
            max={15}
            dir="ltr"
            value={points}
            onChange={(e) => setPoints(Math.min(15, Math.max(0, Number(e.target.value) || 0)))}
            className="w-28 text-start"
            data-testid="offer-credit-points"
          />
        </label>
        {offers.length < MAX && (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setOffers((os) => [...os, { key: newKey(), id: null, applicationId: null, data: { ...EMPTY_OFFER } }])
            }
            data-testid="offer-add"
          >
            <Plus data-icon="inline-start" aria-hidden />
            {s.add}
          </Button>
        )}
      </div>
      {!signedIn && <p className="text-muted-foreground text-sm">{s.signIn}</p>}

      <div
        className={cn("grid gap-4", offers.length === 2 && "lg:grid-cols-2", offers.length === 3 && "lg:grid-cols-3")}
      >
        {offers.map((o, idx) => (
          <OfferColumn
            key={o.key}
            o={o}
            idx={idx}
            res={results[idx]}
            best={best}
            apps={apps}
            s={s}
            ils={ils}
            signedIn={signedIn}
            pending={pending}
            status={status[o.key]}
            onChange={(patch, meta) => update(o.key, patch, meta)}
            onSave={() => save(o)}
            onRemove={() => remove(o)}
          />
        ))}
      </div>
    </div>
  );
}

function OfferColumn({
  o,
  idx,
  res,
  best,
  apps,
  s,
  ils,
  signedIn,
  pending,
  status,
  onChange,
  onSave,
  onRemove,
}: {
  o: OfferDraft;
  idx: number;
  res: OfferResult;
  best: { total: number; net: number };
  apps: { id: string; label: string }[];
  s: SalaryHubStrings["offers"];
  ils: (n: number) => string;
  signedIn: boolean;
  pending: boolean;
  status?: "saved" | "error";
  onChange: (patch: Partial<OfferInput>, meta?: Partial<OfferDraft>) => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const d = o.data;
  const num = (k: NumKey) => (
    <label key={k} className="flex flex-col gap-1 text-xs font-semibold">
      {s.f[k]}
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        dir="ltr"
        value={d[k] === 0 && k !== "equityHaircutPct" ? "" : d[k]}
        placeholder="0"
        onChange={(e) => onChange({ [k]: e.target.value === "" ? 0 : Number(e.target.value) } as Partial<OfferInput>)}
        className="text-start tabular-nums"
        data-testid={`offer-${idx}-${k}`}
      />
    </label>
  );

  return (
    <section
      className="bg-card flex flex-col gap-3 rounded-lg border p-4"
      data-testid={`offer-col-${idx}`}
      aria-label={d.label || `#${idx + 1}`}
    >
      <Input
        value={d.label}
        maxLength={80}
        dir="auto"
        placeholder={`${s.labelPh} ${idx + 1}`}
        onChange={(e) => onChange({ label: e.target.value })}
        className="font-heading text-lg font-bold"
        data-testid={`offer-${idx}-label`}
      />
      <label className="flex flex-col gap-1 text-xs font-semibold">
        {s.f.company}
        <Input value={d.company} maxLength={120} dir="auto" onChange={(e) => onChange({ company: e.target.value })} />
      </label>
      {apps.length > 0 && (
        <label className="flex flex-col gap-1 text-xs font-semibold">
          {s.linkApp}
          <select
            value={o.applicationId ?? ""}
            onChange={(e) => onChange({}, { applicationId: e.target.value || null })}
            className="bg-background min-h-11 rounded-md border px-2 text-sm"
          >
            <option value="">{s.noApp}</option>
            {apps.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {GROUPS.map((g, gi) => (
        <details key={g.key} open={gi === 0} className="rounded-md border p-2">
          <summary className="min-h-9 cursor-pointer text-sm font-bold">{s.groups[g.key]}</summary>
          <div className="mt-2 grid gap-2">
            {g.fields.map(num)}
            {g.key === "social" && (
              <label className="flex min-h-9 items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={d.khOnFullSalary}
                  onChange={(e) => onChange({ khOnFullSalary: e.target.checked })}
                  className="size-4"
                />
                {s.f.khOnFullSalary}
              </label>
            )}
            {g.key === "equity" && <p className="text-muted-foreground text-xs leading-relaxed">{s.equityNote}</p>}
          </div>
        </details>
      ))}
      <label className="flex flex-col gap-1 text-xs font-semibold">
        {s.f.notes}
        <span className="flex items-start gap-2">
          <Textarea
            ref={notesRef}
            value={d.notes}
            maxLength={2000}
            dir="auto"
            rows={2}
            onChange={(e) => onChange({ notes: e.target.value })}
          />
          <VoiceInputButton
            onText={(v) => onChange({ notes: v })}
            getValue={() => notesRef.current?.value ?? ""}
            maxLength={2000}
            compact
          />
        </span>
      </label>

      <div className="border-t pt-3" data-testid={`offer-${idx}-summary`}>
        <h3 className="text-sm font-bold">{s.out.title}</h3>
        <dl className="mt-2 flex flex-col gap-1 text-sm">
          <Row
            label={s.out.annualTotal}
            value={ils(res.annual.total)}
            strong
            best={best.total === idx}
            bestLabel={s.out.best}
          />
          {d.signingBonus > 0 && <Row label={s.out.firstYear} value={ils(res.annual.firstYear)} />}
          <Row label={s.out.netMonthly} value={ils(res.monthly.netCash)} />
          {d.bonusAnnual > 0 && <Row label={s.out.netWithBonus} value={ils(res.monthly.netCashWithBonus)} />}
          <Row
            label={s.out.netValue}
            value={ils(res.monthly.netValue)}
            strong
            best={best.net === idx}
            bestLabel={s.out.best}
          />
          <Row label={s.out.netAnnual} value={ils(res.annual.netEstimate)} />
        </dl>
        <details className="mt-2 text-xs">
          <summary className="min-h-9 cursor-pointer font-semibold">{s.out.deductions}</summary>
          <dl className="mt-1 flex flex-col gap-1">
            <Row label={s.out.base} value={ils(res.annual.base)} />
            <Row label={s.out.bonus} value={ils(res.annual.bonus)} />
            <Row label={s.out.equity} value={ils(res.annual.equity)} />
            {res.annual.equityPaper > 0 && (
              <p className="text-muted-foreground">{fill(s.out.equityPaper, { v: ils(res.annual.equityPaper) })}</p>
            )}
            <Row label={s.out.employerPension} value={ils(res.annual.employerPension)} />
            <Row label={s.out.employerKh} value={ils(res.annual.employerKh)} />
            <Row label={s.out.perks} value={ils(res.annual.perks)} />
            <Row label={s.out.incomeTax} value={ils(res.monthly.incomeTax)} />
            <Row label={s.out.ni} value={ils(res.monthly.nationalInsurance)} />
            <Row label={s.out.pension} value={ils(res.monthly.pensionEmployee)} />
            <Row label={s.out.kh} value={ils(res.monthly.khEmployee)} />
          </dl>
        </details>
        {res.commute.hoursPerMonth > 0 && (
          <p className="text-muted-foreground mt-2 text-xs">
            {fill(s.out.commute, { hours: res.commute.hoursPerMonth, days: res.commute.officeDaysPerMonth })}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {signedIn && (
          <Button type="button" size="sm" onClick={onSave} disabled={pending} data-testid={`offer-${idx}-save`}>
            <Save data-icon="inline-start" aria-hidden />
            {s.save}
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={onRemove} disabled={pending}>
          <Trash2 data-icon="inline-start" aria-hidden />
          {s.remove}
        </Button>
        {status === "saved" && (
          <span role="status" className="text-fit text-xs">
            {s.saved}
          </span>
        )}
        {status === "error" && (
          <span role="alert" className="text-destructive text-xs">
            {s.saveError}
          </span>
        )}
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  strong,
  best,
  bestLabel,
}: {
  label: string;
  value: string;
  strong?: boolean;
  best?: boolean;
  bestLabel?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className={cn("text-muted-foreground", strong && "text-foreground font-semibold")}>{label}</dt>
      <dd className={cn("tabular-nums", strong && "font-bold")} dir="ltr">
        {best && <span className="bg-fit/15 text-fit me-1 rounded px-1 text-[10px] font-bold">{bestLabel}</span>}
        {value}
      </dd>
    </div>
  );
}
