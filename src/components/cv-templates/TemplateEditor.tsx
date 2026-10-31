"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Download,
  Eye,
  EyeOff,
  GripVertical,
  Pencil,
  RotateCcw,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { resetCvLayoutAction, saveCvLayoutAction, setCvTemplateAction } from "@/app/cv/actions";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import { demoContent, type CvContent } from "@/lib/cv-templates/content";
import { blockTitle, sectionHasContent } from "@/lib/cv-templates/resolve";
import { defaultLayout, moveEntry, type LayoutEntry } from "@/lib/cv-templates/sections";
import type { CvTemplate, TemplateId } from "@/lib/cv-templates/templates";
import type { CvLang, CvTemplateStrings } from "@/lib/i18n/cv-templates";
import { fmt } from "@/lib/i18n/learning";
import { cn } from "@/lib/utils";
import { CvPreview } from "./CvPreview";
import { ScaledSheet } from "./ScaledSheet";

type Status = "idle" | "saving" | "saved" | "error";

export interface TemplateEditorProps {
  t: CvTemplateStrings;
  template: TemplateId;
  tpl: CvTemplate;
  content: CvContent;
  demo: boolean;
  written: CvLang;
  initialLayout: LayoutEntry[];
  tailored: { id: string; title: string; company: string; language: CvLang } | null;
  isDefault: boolean;
  canTranslate: boolean;
}

export function TemplateEditor(p: TemplateEditorProps) {
  const { t, template, tpl } = p;
  const e = t.editor;
  const [layout, setLayout] = useState(p.initialLayout);
  const [lang, setLang] = useState<CvLang>(p.written);
  const [status, setStatus] = useState<Status>("idle");
  const [isDefault, setIsDefault] = useState(p.isDefault);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const [, start] = useTransition();
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const content = useMemo(() => (p.demo ? demoContent(lang) : p.content), [p.demo, p.content, lang]);
  const nameOf = (x: LayoutEntry) => blockTitle(content, x, tpl, lang) || x.id;

  // Debounced autosave.
  useEffect(() => {
    if (!dirty.current) return;
    clearTimeout(timer.current);
    setStatus("saving");
    timer.current = setTimeout(() => {
      start(async () => {
        const r = await saveCvLayoutAction(template, layout);
        setStatus(r.ok ? "saved" : "error");
      });
    }, 600);
    return () => clearTimeout(timer.current);
  }, [layout, template]);

  const update = (next: LayoutEntry[]) => {
    dirty.current = true;
    setLayout(next);
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= layout.length) return;
    update(moveEntry(layout, from, to));
    setLive(fmt(e.moved, { name: nameOf(layout[from]), n: to + 1 }));
  };

  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids: string[] = layout.map((x) => x.id);
  const byId = (id: string | number) => layout.find((x) => x.id === id);
  const announcements: Announcements = {
    onDragStart: ({ active }) => fmt(e.picked, { name: nameOf(byId(active.id)!) }),
    onDragOver: ({ active, over }) =>
      over ? fmt(e.moved, { name: nameOf(byId(active.id)!), n: ids.indexOf(String(over.id)) + 1 }) : undefined,
    onDragEnd: ({ active, over }) =>
      over ? fmt(e.moved, { name: nameOf(byId(active.id)!), n: ids.indexOf(String(over.id)) + 1 }) : undefined,
    onDragCancel: () => undefined,
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    update(moveEntry(layout, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  };

  const q = new URLSearchParams({ template, lang });
  if (p.tailored) q.set("tailored", p.tailored.id);
  if (p.demo) q.set("demo", "1");
  const exportHref = (format: "pdf" | "docx") => `/api/cv/export?${q.toString()}&format=${format}`;
  const other = !p.demo && lang !== p.written;
  const langName = (l: CvLang) => (l === "he" ? e.langHe : e.langEn);

  return (
    <div className="flex flex-col gap-5" data-testid="cv-editor">
      <header className="rule-double flex flex-col gap-2 pb-4">
        <Link
          href={`/cv${p.tailored ? `?tailored=${p.tailored.id}` : ""}`}
          className="text-primary inline-flex min-h-10 items-center gap-1 text-sm font-semibold"
        >
          <ArrowLeft className="size-4 rotate-180 ltr:rotate-0" aria-hidden />
          {e.back}
        </Link>
        <p className="kicker">{t.kicker}</p>
        <h1 className="font-heading text-title font-black">{t.templates[template].name}</h1>
        <p className="text-muted-foreground text-sm">
          <span className="text-foreground font-semibold">{t.fitsFor}</span> {t.templates[template].fits}
        </p>
        {p.tailored ? (
          <p className="text-sm font-semibold">
            {fmt(t.tailoredFrom, { title: `${p.tailored.title} · ${p.tailored.company}` })}
          </p>
        ) : null}
        {p.demo ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
            {t.emptyProfile}{" "}
            <Link href="/profile" className="font-semibold underline underline-offset-4">
              {t.toProfile}
            </Link>
          </p>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section aria-labelledby="cv-sections-h" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id="cv-sections-h" className="text-lg font-bold">
              {e.sections}
            </h2>
            <span
              aria-live="polite"
              className={cn("text-xs", status === "error" ? "text-destructive" : "text-muted-foreground")}
              data-testid="cv-save-status"
            >
              {status === "saving" ? e.saving : status === "saved" ? e.saved : status === "error" ? e.saveError : ""}
            </span>
          </div>
          <p className="text-muted-foreground text-sm">{e.sectionsHint}</p>
          <p className="sr-only" aria-live="assertive">
            {live}
          </p>
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
            accessibility={{ announcements, screenReaderInstructions: { draggable: t.keyboardHelp } }}
          >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ol className="flex flex-col gap-2" data-testid="cv-section-list">
                {layout.map((x, i) => (
                  <SectionRow
                    key={x.id}
                    entry={x}
                    index={i}
                    count={layout.length}
                    name={nameOf(x)}
                    empty={!sectionHasContent(content, x.id)}
                    side={tpl.columns === 2 && tpl.sidebar.includes(x.id)}
                    e={e}
                    lang={lang}
                    renaming={renaming === x.id}
                    onRename={() => setRenaming(renaming === x.id ? null : x.id)}
                    onMove={(to) => move(i, to)}
                    onToggle={() => update(layout.map((y) => (y.id === x.id ? { ...y, visible: !y.visible } : y)))}
                    onTitle={(l, v) =>
                      update(layout.map((y) => (y.id === x.id ? { ...y, titles: { ...y.titles, [l]: v } } : y)))
                    }
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="hover:bg-muted inline-flex min-h-11 items-center gap-1 rounded-md border px-3 text-sm font-semibold"
              data-testid="cv-reset"
              onClick={() =>
                start(async () => {
                  dirty.current = false;
                  setLayout(
                    defaultLayout(
                      tpl.defaults,
                      content.custom.map((c) => c.id),
                    ),
                  );
                  const r = await resetCvLayoutAction(template);
                  setStatus(r.ok ? "saved" : "error");
                })
              }
            >
              <RotateCcw className="size-4" aria-hidden />
              {e.reset}
            </button>
            <button
              type="button"
              disabled={isDefault}
              className="hover:bg-muted inline-flex min-h-11 items-center gap-1 rounded-md border px-3 text-sm font-semibold disabled:opacity-60"
              data-testid="cv-set-default"
              onClick={() =>
                start(async () => {
                  const r = await setCvTemplateAction(template);
                  if (r.ok) setIsDefault(true);
                })
              }
            >
              <Star className={cn("size-4", isDefault && "fill-current")} aria-hidden />
              {isDefault ? e.isDefault : e.setDefault}
            </button>
            <Link
              href="/profile?tab=profile"
              className="text-primary inline-flex min-h-11 items-center px-1 text-sm font-semibold underline underline-offset-4"
            >
              {e.editContent}
            </Link>
          </div>
        </section>

        <section aria-labelledby="cv-preview-h" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="cv-preview-h" className="text-lg font-bold">
              {e.preview}
            </h2>
            <div
              role="radiogroup"
              aria-label={e.previewLang}
              className="inline-flex rounded-md border p-0.5"
              data-testid="cv-lang"
            >
              {(["he", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={lang === l}
                  onClick={() => setLang(l)}
                  className={cn(
                    "min-h-10 rounded px-3 text-sm font-semibold",
                    lang === l ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  {langName(l)}
                </button>
              ))}
            </div>
          </div>
          {other ? (
            <p className="bg-muted/60 rounded-md p-2 text-sm" data-testid="cv-translate-note">
              {p.canTranslate
                ? fmt(e.translateNote, { from: langName(p.written), to: langName(lang) })
                : fmt(e.translateOff, { to: langName(lang) })}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2" data-testid="cv-export">
            <span className="text-sm font-semibold">{e.export}:</span>
            {(["pdf", "docx"] as const).map((f) => (
              <a
                key={f}
                href={exportHref(f)}
                download
                data-testid={`cv-export-${f}`}
                className="bg-primary text-primary-foreground inline-flex min-h-11 items-center gap-1 rounded-md px-4 text-sm font-semibold"
              >
                <Download className="size-4" aria-hidden />
                {f === "pdf" ? e.pdf : e.docx} · {langName(lang)}
              </a>
            ))}
          </div>
          <ScaledSheet label={`${e.preview}: ${t.templates[template].name}`}>
            <CvPreview content={content} layout={layout} tpl={tpl} lang={lang} />
          </ScaledSheet>
        </section>
      </div>
    </div>
  );
}

function SectionRow(props: {
  entry: LayoutEntry;
  index: number;
  count: number;
  name: string;
  empty: boolean;
  side: boolean;
  e: CvTemplateStrings["editor"];
  lang: CvLang;
  renaming: boolean;
  onRename: () => void;
  onMove: (to: number) => void;
  onToggle: () => void;
  onTitle: (lang: CvLang, v: string) => void;
}) {
  const { entry: x, index: i, e, name } = props;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: x.id,
  });
  const iconBtn =
    "hover:bg-muted inline-flex size-11 shrink-0 items-center justify-center rounded-md disabled:opacity-40";
  const fieldId = (l: CvLang) => `cv-title-${x.id.replace(/[^\w-]/g, "_")}-${l}`;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid={`cv-row-${x.id}`}
      className={cn(
        "bg-card rounded-md border",
        isDragging && "ring-primary z-10 shadow-lg ring-2",
        !x.visible && "opacity-60",
      )}
    >
      <div className="flex items-center gap-1 p-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={fmt(e.drag, { name })}
          className={cn(iconBtn, "cursor-grab touch-none active:cursor-grabbing")}
          data-testid={`cv-drag-${x.id}`}
        >
          <GripVertical className="size-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-semibold", !x.visible && "line-through")}>{name}</p>
          <p className="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
            {!x.visible ? <span>{e.hidden}</span> : null}
            {props.empty ? <span>{e.empty}</span> : null}
            {props.side ? <span>{e.sidebar}</span> : null}
          </p>
        </div>
        <button
          type="button"
          className={cn(iconBtn, "max-sm:hidden")}
          disabled={i === 0}
          aria-label={fmt(e.moveUp, { name })}
          onClick={() => props.onMove(i - 1)}
        >
          <ArrowUp className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          className={cn(iconBtn, "max-sm:hidden")}
          disabled={i === props.count - 1}
          aria-label={fmt(e.moveDown, { name })}
          onClick={() => props.onMove(i + 1)}
        >
          <ArrowDown className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          className={iconBtn}
          aria-pressed={props.renaming}
          aria-label={fmt(e.rename, { name })}
          onClick={props.onRename}
          data-testid={`cv-rename-${x.id}`}
        >
          <Pencil className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          className={iconBtn}
          aria-pressed={!x.visible}
          aria-label={fmt(x.visible ? e.hide : e.show, { name })}
          onClick={props.onToggle}
          data-testid={`cv-toggle-${x.id}`}
        >
          {x.visible ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
        </button>
      </div>
      {props.renaming ? (
        <div className="grid gap-2 border-t p-2">
          {(["he", "en"] as const).map((l) => (
            <div key={l} className="flex items-center gap-1">
              <label htmlFor={fieldId(l)} className="w-14 shrink-0 text-xs font-semibold">
                {l === "he" ? e.langHe : e.langEn}
              </label>
              <input
                id={fieldId(l)}
                dir={l === "he" ? "rtl" : "ltr"}
                className="input min-h-11 flex-1"
                maxLength={60}
                placeholder={e.renamePh}
                value={x.titles[l] ?? ""}
                onChange={(ev) => props.onTitle(l, ev.target.value)}
              />
              <VoiceInputButton targetId={fieldId(l)} size="sm" compact testId={`cv-title-mic-${l}`} />
            </div>
          ))}
        </div>
      ) : null}
    </li>
  );
}
