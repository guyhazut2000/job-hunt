"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { approveApply } from "@/app/apply/actions";
import { DocumentPicker } from "@/components/documents/DocumentPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { APPLY_PICKER_RULES } from "@/lib/auto-apply/picker";
import type { RuleCode } from "@/lib/auto-apply/rules";
import { parseMulti, type ApplyField } from "@/lib/auto-apply/types";
import type { AttachableDocument } from "@/lib/documents/picker";
import type { AutoApplyStrings } from "@/lib/i18n/auto-apply";
import type { DocumentStrings } from "@/lib/i18n/documents";

export function DraftForm({
  s,
  docs,
  docStrings,
  draftId,
  fields,
  initialRefs,
  blocks,
  needsConfirm,
  api,
}: {
  s: AutoApplyStrings;
  docs: AttachableDocument[];
  docStrings: DocumentStrings;
  draftId: string;
  fields: ApplyField[];
  initialRefs: string[];
  blocks: RuleCode[];
  needsConfirm: boolean;
  api: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(approveApply, null);
  const [refs, setRefs] = useState(initialRefs);
  const hard = blocks.some((b) => b === "blocked_company" || b === "daily_cap");
  const overridable = blocks.some((b) => b === "below_score" || b === "no_score");

  useEffect(() => {
    if (!state?.ok) return;
    if (state.delivery === "handoff") window.open(state.url, "_blank", "noopener,noreferrer");
    router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="draftId" value={draftId} />
      <p className="text-muted-foreground text-sm leading-relaxed">{api ? s.apiNote : s.handoffNote}</p>
      {blocks.map((b) => (
        <p key={b} role="alert" className="text-destructive text-sm font-semibold">
          {s.rules[b]}
        </p>
      ))}
      {state && !state.ok && state.error !== "cv" && (
        <p role="alert" className="text-destructive text-sm font-semibold">
          {state.error === "failed"
            ? s.failed
            : state.error === "needs_input"
              ? s.needsInput
              : state.error === "confirm_flags"
                ? s.confirmFirst
                : state.error in s.rules
                  ? s.rules[state.error as RuleCode]
                  : s.failed}
          {state.detail ? ` (${state.detail})` : ""}
        </p>
      )}
      <ul className="flex flex-col gap-4">
        {fields
          .filter((f) => f.kind !== "file")
          .map((field) => (
            <li key={field.id} className="flex flex-col gap-1.5">
              <span className="flex flex-wrap items-center gap-2">
                <label htmlFor={`field-${field.id}`} className="text-sm font-semibold">
                  {field.label}
                  {field.required ? <span aria-hidden> *</span> : null}
                </label>
                {field.flagReason && (
                  <Badge id={`flag-${field.id}`} variant="outline">
                    {s.flags[field.flagReason]}
                  </Badge>
                )}
              </span>
              <FieldControl field={field} s={s} describedBy={field.flagReason ? `flag-${field.id}` : undefined} />
            </li>
          ))}
      </ul>
      <DocumentPicker t={docStrings} docs={docs} rules={APPLY_PICKER_RULES} value={refs} onChange={setRefs} />
      {overridable && (
        <label className="flex min-h-11 items-start gap-2 text-sm">
          <input type="checkbox" name="ruleOverride" className="accent-foreground mt-1 size-4" />
          <span>{s.override}</span>
        </label>
      )}
      {needsConfirm && (
        <label className="flex min-h-11 items-start gap-2 text-sm">
          <input type="checkbox" name="confirmFlags" className="accent-foreground mt-1 size-4" />
          <span>{s.confirmFlags}</span>
        </label>
      )}
      <Button type="submit" disabled={pending || hard} data-testid="approve-apply">
        {s.approve}
      </Button>
      {state?.ok && state.delivery === "handoff" && (
        <a
          href={state.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary text-sm font-semibold underline"
        >
          {s.openForm}
        </a>
      )}
    </form>
  );
}

function FieldControl({ field, s, describedBy }: { field: ApplyField; s: AutoApplyStrings; describedBy?: string }) {
  const id = `field-${field.id}`;
  const invalid = field.flagged && field.required;
  if (field.kind === "long") {
    return (
      <Textarea
        id={id}
        name={`field:${field.id}`}
        defaultValue={field.value}
        dir="auto"
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />
    );
  }
  if (field.kind === "select") {
    return (
      <select
        id={id}
        name={`field:${field.id}`}
        defaultValue={field.value}
        className="select-native"
        aria-invalid={invalid}
        aria-describedby={describedBy}
      >
        <option value="">{s.choose}</option>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.kind === "multi") return <MultiField field={field} id={id} />;
  if (field.kind === "boolean") {
    return (
      <label className="flex min-h-11 items-center gap-2 text-sm" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          name={`field:${field.id}`}
          defaultChecked={field.value === "true"}
          className="accent-foreground size-4"
          aria-describedby={describedBy}
        />
        <span>{s.yes}</span>
      </label>
    );
  }
  const ltr = field.kind === "number" || /email|url|phone|linkedin|github/i.test(field.id);
  return (
    <Input
      id={id}
      name={`field:${field.id}`}
      defaultValue={field.value}
      dir={ltr ? "ltr" : "auto"}
      inputMode={field.kind === "number" ? "decimal" : undefined}
      aria-invalid={invalid}
      aria-describedby={describedBy}
    />
  );
}

function MultiField({ field, id }: { field: ApplyField; id: string }) {
  const initial = parseMulti(field.value);
  const [picked, setPicked] = useState(initial);
  return (
    <fieldset id={id} className="flex flex-col gap-1">
      {field.options.map((o) => (
        <label key={o.value} className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={`field:${field.id}`}
            value={o.value}
            checked={picked.includes(o.value)}
            onChange={() =>
              setPicked((cur) => (cur.includes(o.value) ? cur.filter((v) => v !== o.value) : [...cur, o.value]))
            }
            className="accent-foreground size-4"
          />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
