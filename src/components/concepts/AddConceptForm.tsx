"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Plus, Sparkles } from "lucide-react";
import { addConcept } from "@/app/learn/concepts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import { NAME_MAX, type ConceptKind } from "@/lib/concepts/core";
import type { ConceptStrings } from "@/lib/i18n/concepts";
import { cn } from "@/lib/utils";

export interface CompanyOption {
  id: string;
  name: string;
}

export function AddConceptForm({
  t,
  companies,
  defaultKind = "TECH",
  defaultCompanyId,
  lockCompany = false,
}: {
  t: ConceptStrings;
  companies: CompanyOption[];
  defaultKind?: ConceptKind;
  defaultCompanyId?: string;
  lockCompany?: boolean;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<ConceptKind>(defaultKind);
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError(t.nameRequired);
    if (kind === "COMPANY" && !companyId) return setError(t.companyRequired);
    start(async () => {
      const r = await addConcept({ name, kind, companyId: kind === "COMPANY" ? companyId : null, source: "manual" });
      if (r.ok) router.push(`/learn/concepts/${r.id}`);
      else setError(r.error === "company" ? t.companyRequired : r.error === "name" ? t.nameRequired : t.errorGeneric);
    });
  }

  return (
    <form
      onSubmit={submit}
      className="bg-card flex flex-col gap-3 rounded-2xl border p-4 shadow-sm sm:p-5"
      data-testid="concept-add"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{t.addTitle}</h2>
        {!lockCompany && (
          <div role="radiogroup" aria-label={t.filterKind} className="bg-secondary inline-flex rounded-full p-1">
            {(["TECH", "COMPANY"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors",
                  kind === k ? "bg-background text-foreground shadow-sm" : "text-foreground/70 hover:text-foreground",
                )}
              >
                {k === "TECH" ? (
                  <Sparkles className="size-4" aria-hidden />
                ) : (
                  <Building2 className="size-4" aria-hidden />
                )}
                {k === "TECH" ? t.kindTech : t.kindCompany}
              </button>
            ))}
          </div>
        )}
      </div>
      {kind === "COMPANY" && !lockCompany && (
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t.companyLabel}
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="border-input bg-background h-11 rounded-lg border px-3 text-base font-normal"
            data-testid="concept-company"
          >
            <option value="">{t.companyPick}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX}
            placeholder={kind === "COMPANY" ? t.addPlaceholderCompany : t.addPlaceholder}
            aria-label={t.addTitle}
            dir="auto"
            className="h-11 text-base"
            data-testid="concept-name"
          />
        </div>
        <VoiceInputButton targetRef={inputRef} maxLength={NAME_MAX} compact disabled={pending} testId="concept-voice" />
        <Button type="submit" disabled={pending} className="shrink-0 rounded-full">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          <span className="max-sm:sr-only">{t.addCta}</span>
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
