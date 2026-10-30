"use client";

import { ArrowUp, Loader2, Lock, Plus, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveTailoredAction } from "@/app/cv/tailor/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type DiffPart, wordDiff } from "@/lib/cv-tailor/diff";
import type { CvDoc, CvLanguage } from "@/lib/cv-tailor/types";
import { CV_HEADINGS, type CvTailorStrings } from "@/lib/i18n/cv-tailor";
import { CvSheet } from "./CvSheet";

type Tab = "compare" | "edit" | "preview";

function Diff({ parts }: { parts: DiffPart[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.type === "same" ? (
          <span key={i}>{p.text}</span>
        ) : p.type === "add" ? (
          <ins key={i} className="bg-fit-soft text-fit rounded-sm no-underline">
            {p.text}
          </ins>
        ) : (
          <del key={i} className="text-muted-foreground decoration-destructive/60 rounded-sm">
            {p.text}
          </del>
        ),
      )}
    </>
  );
}

function Pair({ base, tailored, label }: { base: string; tailored: string; label: string }) {
  if (!base && !tailored) return null;
  return (
    <div className="flex flex-col gap-1">
      <h3 className="kicker">{label}</h3>
      <div className="grid gap-2 md:grid-cols-2">
        <p className="bg-muted/50 rounded-md p-2 text-sm whitespace-pre-line" dir="auto">
          {base}
        </p>
        <p className="rounded-md border p-2 text-sm whitespace-pre-line" dir="auto">
          <Diff parts={wordDiff(base, tailored)} />
        </p>
      </div>
    </div>
  );
}

function Compare({
  base,
  doc,
  language,
  t,
  highlight,
}: {
  base: CvDoc;
  doc: CvDoc;
  language: CvLanguage;
  t: CvTailorStrings;
  highlight: Set<string>;
}) {
  const h = CV_HEADINGS[language];
  return (
    <div className="flex flex-col gap-5" data-testid="cvt-compare" lang={language}>
      <div className="text-muted-foreground hidden grid-cols-2 gap-2 text-xs font-semibold md:grid">
        <span>{t.baseCol}</span>
        <span>{t.tailoredCol}</span>
      </div>
      <p className="flex flex-wrap gap-3 text-xs">
        <ins className="bg-fit-soft text-fit rounded-sm px-1 no-underline">{t.legendAdd}</ins>
        <del className="text-muted-foreground px-1">{t.legendDel}</del>
        <span className="text-primary inline-flex items-center gap-0.5">
          <ArrowUp className="size-3" aria-hidden />
          {t.movedUp}
        </span>
      </p>
      <Pair label={h.headline} base={base.headline} tailored={doc.headline} />
      <Pair label={h.summary} base={base.summary} tailored={doc.summary} />
      {doc.experience.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="kicker">{h.experience}</h3>
          {doc.experience.map((role) => {
            const b = base.experience.find((x) => x.id === role.id);
            return (
              <div key={role.id} className="flex flex-col gap-1.5 rounded-lg border p-3">
                <p className="font-semibold" dir="auto">
                  {role.title} · {role.company}
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  <ul className="bg-muted/50 flex list-disc flex-col gap-1 rounded-md p-2 ps-6 text-sm">
                    {(b?.bullets ?? []).map((x, i) => (
                      <li key={i} dir="auto">
                        {x}
                      </li>
                    ))}
                  </ul>
                  <ul className="flex list-disc flex-col gap-1 rounded-md border p-2 ps-6 text-sm">
                    {role.bullets.map((x, i) => {
                      const o = role.origin?.[i] ?? -1;
                      const orig = o >= 0 ? (b?.bullets[o] ?? "") : "";
                      return (
                        <li key={i} dir="auto">
                          {o >= 0 && o > i && (
                            <ArrowUp className="text-primary me-1 inline size-3" aria-label={t.movedUp} />
                          )}
                          <Diff parts={wordDiff(orig, x)} />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            );
          })}
        </section>
      )}
      {doc.skills.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h3 className="kicker">{h.skills}</h3>
          <div className="grid gap-2 md:grid-cols-2">
            <p className="bg-muted/50 flex flex-wrap gap-1 rounded-md p-2 text-xs" dir="ltr">
              {base.skills.map((s) => (
                <span key={s} className="bg-background rounded px-1.5 py-0.5">
                  {s}
                </span>
              ))}
            </p>
            <p className="flex flex-wrap gap-1 rounded-md border p-2 text-xs" dir="ltr">
              {doc.skills.map((s) => (
                <span
                  key={s}
                  className={
                    highlight.has(s.toLowerCase())
                      ? "bg-fit-soft text-fit rounded px-1.5 py-0.5 font-semibold"
                      : "bg-muted rounded px-1.5 py-0.5"
                  }
                >
                  {s}
                </span>
              ))}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function Editor({
  doc,
  setDoc,
  language,
  t,
}: {
  doc: CvDoc;
  setDoc: (d: CvDoc) => void;
  language: CvLanguage;
  t: CvTailorStrings;
}) {
  const h = CV_HEADINGS[language];
  const setRole = (id: string, bullets: string[], origin: number[]) =>
    setDoc({ ...doc, experience: doc.experience.map((r) => (r.id === id ? { ...r, bullets, origin } : r)) });
  return (
    <div
      className="flex flex-col gap-4"
      data-testid="cvt-editor"
      lang={language}
      dir={language === "he" ? "rtl" : "ltr"}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cvt-headline">{h.headline}</Label>
        <Input
          id="cvt-headline"
          value={doc.headline}
          maxLength={200}
          onChange={(e) => setDoc({ ...doc, headline: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cvt-summary">{h.summary}</Label>
        <Textarea
          id="cvt-summary"
          rows={4}
          value={doc.summary}
          maxLength={2000}
          onChange={(e) => setDoc({ ...doc, summary: e.target.value })}
        />
      </div>
      <section className="flex flex-col gap-3">
        <h3 className="kicker">{h.experience}</h3>
        <p className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <Lock className="size-3" aria-hidden />
          {t.lockedNote}
        </p>
        {doc.experience.map((role) => {
          const origin = role.origin ?? role.bullets.map((_, i) => i);
          return (
            <fieldset key={role.id} className="flex flex-col gap-2 rounded-lg border p-3">
              <legend className="px-1 font-semibold">
                {role.title} · {role.company}
              </legend>
              {role.bullets.map((b, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <Textarea
                    aria-label={`${role.title} ${i + 1}`}
                    rows={2}
                    value={b}
                    maxLength={600}
                    onChange={(e) =>
                      setRole(
                        role.id,
                        role.bullets.map((x, j) => (j === i ? e.target.value : x)),
                        origin,
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t.removeBullet}
                    onClick={() =>
                      setRole(
                        role.id,
                        role.bullets.filter((_, j) => j !== i),
                        origin.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <X aria-hidden />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit"
                onClick={() => setRole(role.id, [...role.bullets, ""], [...origin, -1])}
              >
                <Plus className="size-4" aria-hidden />
                {t.addBullet}
              </Button>
            </fieldset>
          );
        })}
      </section>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cvt-skills">{h.skills}</Label>
        <p className="text-muted-foreground text-xs">{t.skillsHint}</p>
        <Textarea
          id="cvt-skills"
          dir="ltr"
          rows={3}
          defaultValue={doc.skills.join(", ")}
          onChange={(e) =>
            setDoc({
              ...doc,
              skills: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 80),
            })
          }
        />
      </div>
    </div>
  );
}

export function CvWorkspace({
  id,
  base,
  initial,
  language,
  highlight,
  t,
}: {
  id: string;
  base: CvDoc;
  initial: CvDoc;
  language: CvLanguage;
  highlight: string[];
  t: CvTailorStrings;
}) {
  const [tab, setTab] = useState<Tab>("compare");
  const [doc, setDoc] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const hl = new Set(highlight.map((s) => s.toLowerCase()));
  const tabs: { v: Tab; l: string }[] = [
    { v: "compare", l: t.tabCompare },
    { v: "edit", l: t.tabEdit },
    { v: "preview", l: t.tabPreview },
  ];
  const save = () =>
    start(async () => {
      setError(null);
      const res = await saveTailoredAction(id, doc);
      if (res.error || !res.id) return setError(res.error ?? t.saveError);
      setDirty(false);
      router.push(`/cv/tailor/${res.id}`);
    });
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div role="tablist" className="bg-muted flex w-full gap-1 overflow-x-auto rounded-full p-1 sm:w-fit">
        {tabs.map((x) => (
          <button
            key={x.v}
            type="button"
            role="tab"
            aria-selected={tab === x.v}
            data-testid={`cvt-tab-${x.v}`}
            onClick={() => setTab(x.v)}
            className="aria-selected:bg-background aria-selected:text-foreground text-muted-foreground min-h-10 flex-1 rounded-full px-4 text-sm font-semibold whitespace-nowrap aria-selected:shadow-sm sm:flex-none"
          >
            {x.l}
          </button>
        ))}
      </div>
      {tab === "compare" && <Compare base={base} doc={doc} language={language} t={t} highlight={hl} />}
      {tab === "edit" && (
        <Editor
          doc={doc}
          setDoc={(d) => {
            setDoc(d);
            setDirty(true);
          }}
          language={language}
          t={t}
        />
      )}
      {tab === "preview" && <CvSheet doc={doc} language={language} highlight={highlight} />}
      {(dirty || tab === "edit") && (
        <div className="bg-background/95 sticky bottom-[calc(var(--bottom-nav-h,0px)+0.5rem)] z-10 flex flex-wrap items-center gap-3 rounded-full border p-2 backdrop-blur md:bottom-2">
          <Button
            type="button"
            onClick={save}
            disabled={pending || !dirty}
            className="rounded-full"
            data-testid="cvt-save"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            {pending ? t.saving : t.save}
          </Button>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
