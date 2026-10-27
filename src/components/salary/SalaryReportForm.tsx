"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef } from "react";
import { reportSalary, type SalaryReportState } from "@/app/salary/actions";
import { Button } from "@/components/ui/button";
import type { SalaryStrings } from "@/lib/i18n/salary";
import type { SalaryFamily, SalaryLevel } from "@/lib/salary/reference";

export function SalaryReportForm({
  companyId,
  defaultFamily,
  defaultLevel,
  families,
  levels,
  s,
  loggedIn,
  idPrefix = "salary",
}: {
  companyId: string;
  defaultFamily?: SalaryFamily;
  defaultLevel?: SalaryLevel;
  families: [SalaryFamily, string][];
  levels: [SalaryLevel, string][];
  s: SalaryStrings["report"];
  loggedIn: boolean;
  idPrefix?: string;
}) {
  const [state, action, pending] = useActionState<SalaryReportState, FormData>(reportSalary, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  const id = (k: string) => `${idPrefix}-${k}`;

  if (!loggedIn)
    return (
      <p className="text-muted-foreground text-sm">
        {s.loginHint}{" "}
        <Link
          href="/login"
          className="text-foreground inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
        >
          {s.login}
        </Link>
      </p>
    );

  const error = state && !state.ok ? state.error : null;
  return (
    <form
      ref={form}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="grid gap-4 sm:grid-cols-2"
      noValidate={false}
    >
      <input type="hidden" name="companyId" value={companyId} />
      <div>
        <label className="label" htmlFor={id("family")}>
          {s.family}
        </label>
        <select id={id("family")} name="family" required defaultValue={defaultFamily} className="select-native">
          {families.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={id("level")}>
          {s.level}
        </label>
        <select
          id={id("level")}
          name="seniority"
          required
          defaultValue={defaultLevel ?? "MID"}
          className="select-native"
        >
          {levels.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={id("gross")}>
          {s.gross}
        </label>
        <input
          id={id("gross")}
          name="monthlyGrossIls"
          type="number"
          inputMode="numeric"
          required
          min={3000}
          max={200000}
          step={100}
          placeholder="32000"
          className="input font-mono"
          dir="ltr"
          aria-invalid={error === "outOfRange" || undefined}
          aria-describedby={error ? id("err") : undefined}
        />
      </div>
      <div>
        <label className="label" htmlFor={id("years")}>
          {s.years}
        </label>
        <input
          id={id("years")}
          name="yearsExperience"
          type="number"
          inputMode="numeric"
          min={0}
          max={50}
          className="input font-mono"
          dir="ltr"
        />
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <p className="text-muted-foreground text-xs">{s.privacy}</p>
        <Button type="submit" disabled={pending} className="w-full sm:w-fit">
          {pending ? s.sending : s.submit}
        </Button>
        <p
          aria-live="polite"
          id={id("err")}
          className={error ? "text-destructive text-sm" : "text-fit text-sm font-semibold"}
        >
          {error ? s.errors[error] : state?.ok ? (state.updated ? s.updated : s.ok) : null}
        </p>
      </div>
    </form>
  );
}
