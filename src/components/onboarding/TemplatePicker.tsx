"use client";

import { Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CvPreview } from "@/components/cv-templates/CvPreview";
import { ScaledSheet } from "@/components/cv-templates/ScaledSheet";
import type { CvContent } from "@/lib/cv-templates/content";
import type { LayoutEntry } from "@/lib/cv-templates/sections";
import { TEMPLATES, type TemplateId } from "@/lib/cv-templates/templates";
import type { CvLang, CvTemplateStrings } from "@/lib/i18n/cv-templates";
import { cn } from "@/lib/utils";

/** Onboarding step 4: radio list of the 5 templates (recommended first) + a live preview of the pick. */
export function TemplatePicker({
  order,
  recommended,
  initial,
  content,
  layouts,
  lang,
  t,
  label,
  customize,
}: {
  order: TemplateId[];
  recommended: TemplateId;
  initial: TemplateId;
  content: CvContent;
  layouts: Record<TemplateId, LayoutEntry[]>;
  lang: CvLang;
  t: CvTemplateStrings;
  label: string;
  customize: string;
}) {
  const [pick, setPick] = useState<TemplateId>(initial);
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <input type="hidden" name="template" value={pick} />
      <div role="radiogroup" aria-label={label} className="flex flex-col gap-2" data-testid="onb-templates">
        {order.map((id) => {
          const s = t.templates[id];
          const on = pick === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPick(id)}
              data-testid={`onb-template-${id}`}
              className={cn(
                "bg-card flex min-h-11 items-start gap-3 rounded-md border p-3 text-start",
                on ? "border-primary ring-primary ring-2" : "hover:bg-muted/60",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border",
                  on ? "bg-primary border-primary text-primary-foreground" : "",
                )}
              >
                {on ? <Check className="size-3.5" /> : null}
              </span>
              <span className="flex flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2 font-bold">
                  <span
                    aria-hidden
                    className="inline-block size-3 rounded-full"
                    style={{ backgroundColor: TEMPLATES[id].accent }}
                  />
                  {s.name}
                  {id === recommended ? (
                    <span
                      className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                      data-testid="onb-recommended"
                    >
                      <Sparkles className="size-3" aria-hidden />
                      {t.recommended}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground text-sm">
                  <span className="text-foreground font-semibold">{t.fitsFor}</span> {s.fits}
                </span>
              </span>
            </button>
          );
        })}
        <Link
          href={`/cv/templates/${pick}`}
          className="text-primary inline-flex min-h-11 items-center self-start text-sm font-semibold underline underline-offset-4"
          data-testid="onb-customize"
        >
          {customize}
        </Link>
      </div>
      <div className="rounded-md border bg-neutral-100 p-2 dark:bg-neutral-900" data-testid="onb-preview">
        <ScaledSheet maxHeight={560} label={t.templates[pick].name}>
          <CvPreview content={content} layout={layouts[pick]} tpl={TEMPLATES[pick]} lang={lang} />
        </ScaledSheet>
      </div>
    </div>
  );
}
