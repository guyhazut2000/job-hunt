"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { Building2, Loader2, Search, Sparkles, X } from "lucide-react";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import { normalizeSearchText } from "@/lib/search/query";
import { cn } from "@/lib/utils";

export interface SearchSuggestion {
  kind: "company" | "skill";
  label: string;
  /** URL params to set when picked (the free text is cleared). */
  params: Record<string, string>;
  /** Extra text to match on (aliases, domain). */
  keywords?: string;
}

export interface SearchBoxStrings {
  label: string;
  placeholder: string;
  clear: string;
  shortcut: string;
  submit: string;
  companies?: string;
  skills?: string;
}

const DEBOUNCE_MS = 300;
const MAX_SUGGESTIONS = 6;

/**
 * URL-driven search field (`?q=`). Typing updates the URL after a short pause (the first update of a
 * typing session pushes a history entry, later ones replace it, so Back returns to the pre-search
 * page); Enter commits immediately; "/" focuses it from anywhere; the × clears it. Works as a plain
 * GET form without JavaScript.
 */
export function SearchBox({
  s,
  param = "q",
  resetParams = ["page"],
  suggestions = [],
  className,
  testId,
}: {
  s: SearchBoxStrings;
  param?: string;
  /** Params dropped whenever the query changes (e.g. pagination). */
  resetParams?: string[];
  suggestions?: SearchSuggestion[];
  className?: string;
  testId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const urlValue = sp.get(param) ?? "";
  const [value, setValue] = useState(urlValue);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pushedThisSession = useRef(false);
  const lastSent = useRef(urlValue);
  const listId = useId();

  // Back/forward (or a chip removing the query) changes the URL: mirror it into the field.
  useEffect(() => {
    if (urlValue !== lastSent.current) {
      lastSent.current = urlValue;
      setValue(urlValue);
    }
  }, [urlValue]);

  const hrefFor = useCallback(
    (next: Record<string, string | null>) => {
      const p = new URLSearchParams(sp.toString());
      for (const k of resetParams) p.delete(k);
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === "") p.delete(k);
        else p.set(k, v);
      }
      const qs = p.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [sp, pathname, resetParams],
  );

  const navigate = useCallback(
    (q: string, mode: "auto" | "push") => {
      clearTimeout(timer.current);
      const trimmed = q.trim();
      if (trimmed === (sp.get(param) ?? "").trim()) return;
      lastSent.current = trimmed;
      const href = hrefFor({ [param]: trimmed });
      const push = mode === "push" || !pushedThisSession.current;
      pushedThisSession.current = true;
      startTransition(() => (push ? router.push(href, { scroll: false }) : router.replace(href, { scroll: false })));
    },
    [hrefFor, param, router, sp],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  // "/" focuses the search from anywhere that isn't already a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const matches = useMemo(() => {
    const q = normalizeSearchText(value);
    if (q.length < 2 || !suggestions.length) return [];
    const scored = suggestions
      .map((sg) => {
        const label = normalizeSearchText(sg.label);
        const extra = sg.keywords ? normalizeSearchText(sg.keywords) : "";
        const rank = label.startsWith(q) ? 0 : label.includes(q) ? 1 : extra.includes(q) ? 2 : -1;
        return { sg, rank };
      })
      .filter((x) => x.rank >= 0)
      .sort((a, b) => a.rank - b.rank || a.sg.label.localeCompare(b.sg.label));
    const pick = (kind: SearchSuggestion["kind"]) =>
      scored
        .filter((x) => x.sg.kind === kind)
        .slice(0, MAX_SUGGESTIONS / 2)
        .map((x) => x.sg);
    return [...pick("company"), ...pick("skill")];
  }, [value, suggestions]);

  const showList = open && matches.length > 0;

  const choose = (sg: SearchSuggestion) => {
    clearTimeout(timer.current);
    setOpen(false);
    setValue("");
    lastSent.current = "";
    pushedThisSession.current = true;
    const href = hrefFor({ [param]: null, ...sg.params });
    startTransition(() => router.push(href, { scroll: false }));
  };

  // Hidden inputs keep the other params when the form is submitted without JavaScript.
  const hidden = [...sp.entries()].filter(([k]) => k !== param && !resetParams.includes(k));

  return (
    <form
      role="search"
      aria-label={s.label}
      action={pathname}
      method="get"
      className={cn("relative w-full", className)}
      data-testid={testId}
      onSubmit={(e) => {
        e.preventDefault();
        if (showList && active >= 0 && matches[active]) return choose(matches[active]);
        setOpen(false);
        navigate(value, "push");
      }}
    >
      {hidden.map(([k, v], i) => (
        <input key={`${k}-${i}`} type="hidden" name={k} value={v} />
      ))}
      <label htmlFor={`${listId}-input`} className="sr-only">
        {s.label}
      </label>
      <div className="relative">
        <span className="text-muted-foreground pointer-events-none absolute inset-y-0 start-3 flex items-center">
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Search className="size-4" aria-hidden />
          )}
        </span>
        <input
          ref={inputRef}
          id={`${listId}-input`}
          name={param}
          type="search"
          dir="auto"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          maxLength={100}
          placeholder={s.placeholder}
          value={value}
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-opt-${active}` : undefined}
          aria-keyshortcuts="/"
          className="input bg-card h-12 min-h-12 ps-10 pe-24 text-base shadow-xs placeholder:text-start [&::-webkit-search-cancel-button]:appearance-none"
          onChange={(e) => {
            const v = e.target.value;
            setValue(v);
            setOpen(true);
            setActive(-1);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => navigate(v, "auto"), DEBOUNCE_MS);
          }}
          onFocus={() => {
            pushedThisSession.current = false;
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              if (showList) setOpen(false);
              else if (value) {
                setValue("");
                navigate("", "push");
              }
              return;
            }
            if (!showList) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % matches.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a <= 0 ? matches.length - 1 : a - 1));
            }
          }}
        />
        <div className="absolute inset-y-0 end-1.5 flex items-center gap-1">
          <VoiceInputButton
            targetRef={inputRef}
            size="sm"
            compact
            hideWhenUnsupported
            className="[&_button[aria-pressed]]:border-transparent"
            testId={testId ? `${testId}-voice` : "search-voice"}
          />
          {value ? (
            <button
              type="button"
              aria-label={s.clear}
              title={s.clear}
              className="text-muted-foreground hover:text-foreground hover:bg-muted grid size-9 place-items-center rounded-md"
              onClick={() => {
                setValue("");
                setOpen(false);
                navigate("", "push");
                inputRef.current?.focus();
              }}
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : (
            <kbd
              aria-hidden
              title={s.shortcut}
              className="text-muted-foreground bg-muted hidden h-6 min-w-6 place-items-center rounded border px-1.5 font-mono text-xs md:grid"
            >
              /
            </kbd>
          )}
          <button type="submit" className="sr-only">
            {s.submit}
          </button>
        </div>
      </div>

      <ul
        id={`${listId}-list`}
        role="listbox"
        aria-label={s.label}
        hidden={!showList}
        className="bg-popover text-popover-foreground scroll-thin absolute inset-x-0 top-full z-40 mt-1 max-h-80 overflow-y-auto overscroll-contain rounded-md border p-1 shadow-lg"
      >
        {matches.map((sg, i) => {
          const Icon = sg.kind === "company" ? Building2 : Sparkles;
          const first = i === 0 || matches[i - 1].kind !== sg.kind;
          return (
            <li key={`${sg.kind}-${sg.label}`} role="presentation">
              {first && (
                <p className="kicker px-2 pt-2 pb-1" aria-hidden>
                  {sg.kind === "company" ? s.companies : s.skills}
                </p>
              )}
              <div
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm",
                  i === active ? "bg-muted" : "hover:bg-muted/70",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(sg)}
              >
                <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <span dir="auto" className="truncate font-medium">
                  {sg.label}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </form>
  );
}
