"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ContactCategory, PeopleGroup } from "@prisma/client";
import { Check, ExternalLink, EyeOff, Flag, MapPin, MoreVertical, RotateCw, Search, UserPlus } from "lucide-react";
import { addContact } from "@/app/outreach/actions";
import { suppressPerson } from "@/app/outreach/people-actions";
import { TruncatedText } from "@/components/TruncatedText";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/lib/i18n/dictionaries";
import type { PeopleSearchStrings } from "@/lib/i18n/people-search";
import { personalize, type OutreachLang, type OutreachMessage } from "@/lib/outreach/messages";
import { GROUP_CATEGORY, PEOPLE_GROUPS } from "@/lib/people/groups";
import { firstName, initials, type PersonCard } from "@/lib/people/parse";
import type { PeopleSearchResponse } from "@/lib/people/service";
import { cn } from "@/lib/utils";
import { CopyButton } from "./CopyButton";

type Status = Exclude<PeopleSearchResponse["status"], "ok">;
interface GroupState {
  people: PersonCard[];
  uncertain: PersonCard[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  status: Status | null;
  fetchedAt: string | null;
}

export interface PeopleCardsCategory {
  linkedin: string;
  google: string;
  messages: Record<OutreachLang, OutreachMessage>;
}

const EMPTY: GroupState = {
  people: [],
  uncertain: [],
  page: -1,
  hasMore: true,
  loading: false,
  status: null,
  fetchedAt: null,
};

const dedupe = (a: PersonCard[], b: PersonCard[]) => {
  const seen = new Set(a.map((p) => p.key));
  return [...a, ...b.filter((p) => !seen.has(p.key))];
};

/**
 * Person cards from public web-search results (Brave). Never fetches LinkedIn — the user opens profiles themselves.
 * Falls back to the deep-link search buttons when search is not configured or out of quota.
 */
export function PeopleCards({
  company,
  jobId,
  enabled,
  loggedIn,
  lang,
  locale,
  categories,
  savedKeys,
  s,
}: {
  company: { id: string; name: string };
  jobId?: string | null;
  enabled: boolean;
  loggedIn: boolean;
  lang: OutreachLang;
  locale: Locale;
  categories: Partial<Record<ContactCategory, PeopleCardsCategory>>;
  /** Normalised profile keys already saved as contacts. */
  savedKeys: string[];
  s: PeopleSearchStrings;
}) {
  const uid = useId();
  const [group, setGroup] = useState<PeopleGroup>("RECRUITER");
  const [state, setState] = useState<Partial<Record<PeopleGroup, GroupState>>>({});
  const [showUncertain, setShowUncertain] = useState(false);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(() => new Set(savedKeys));
  const [visible, setVisible] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const inflight = useRef(new Set<string>());

  const load = useCallback(
    async (g: PeopleGroup, page: number) => {
      const k = `${g}:${page}`;
      if (inflight.current.has(k)) return;
      inflight.current.add(k);
      setState((st) => ({ ...st, [g]: { ...(st[g] ?? EMPTY), loading: true, status: null } }));
      try {
        const qs = new URLSearchParams({ companyId: company.id, group: g, page: String(page) });
        if (jobId) qs.set("jobId", jobId);
        const res = await fetch(`/api/people/search?${qs}`, { cache: "no-store" });
        const r = (await res.json().catch(() => ({ status: "error" }))) as PeopleSearchResponse;
        setState((st) => {
          const prev = st[g] ?? EMPTY;
          if (r.status !== "ok") return { ...st, [g]: { ...prev, loading: false, status: r.status } };
          return {
            ...st,
            [g]: {
              people: dedupe(prev.people, r.people),
              uncertain: dedupe(prev.uncertain, r.uncertain),
              page: r.page,
              hasMore: r.hasMore,
              loading: false,
              status: null,
              fetchedAt: prev.fetchedAt ?? r.fetchedAt,
            },
          };
        });
      } catch {
        setState((st) => ({ ...st, [g]: { ...(st[g] ?? EMPTY), loading: false, status: "error" } }));
      } finally {
        inflight.current.delete(k);
      }
    },
    [company.id, jobId],
  );

  // Only search once the section scrolls into view, so page views that never reach it cost nothing.
  useEffect(() => {
    if (!enabled || !loggedIn || !rootRef.current) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setVisible(true), {
      rootMargin: "200px",
    });
    io.observe(rootRef.current);
    return () => io.disconnect();
  }, [enabled, loggedIn]);

  useEffect(() => {
    if (visible && !state[group]) void load(group, 0);
  }, [visible, group, state, load]);

  if (!enabled || !loggedIn) {
    return (
      <p className="text-muted-foreground bg-muted/40 rounded-lg border border-dashed p-3 text-sm">
        {enabled ? s.loginHint : s.disabled}
      </p>
    );
  }

  const st = state[group] ?? EMPTY;
  const category = GROUP_CATEGORY[group];
  const cat = categories[category];
  const people = st.people.filter((p) => !removed.has(p.key));
  const uncertain = st.uncertain.filter((p) => !removed.has(p.key));
  const firstLoad = st.loading && st.page < 0;
  const blocked = st.status === "quota" || st.status === "daily_cap" || st.status === "disabled";
  const statusText: Record<Status, string> = {
    disabled: s.disabled,
    not_found: s.error,
    error: s.error,
    rate_limited: s.rateLimited,
    daily_cap: s.dailyCap,
    quota: s.quota,
  };
  const dateFmt = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
    dateStyle: "medium",
    timeZone: "Asia/Jerusalem",
  });

  const cardProps = {
    company,
    jobId,
    lang,
    s,
    category,
    message: cat?.messages[lang],
    onRemoved: (key: string) => setRemoved((r) => new Set(r).add(key)),
    onSaved: (key: string) => setSaved((x) => new Set(x).add(key)),
  };

  return (
    <section ref={rootRef} data-people-cards aria-labelledby={`${uid}-h`} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 id={`${uid}-h`} className="font-heading text-lg font-bold">
          {s.title}
        </h3>
        <p className="text-muted-foreground max-w-prose text-sm">{s.intro}</p>
      </div>

      <fieldset className="min-w-0">
        <legend className="sr-only">{s.title}</legend>
        <div className="flex flex-wrap gap-2">
          {PEOPLE_GROUPS.map((g) => (
            <label key={g} className="toggle-chip relative">
              <input
                type="radio"
                className="sr-only"
                name={`${uid}-group`}
                value={g}
                checked={group === g}
                onChange={() => {
                  setGroup(g);
                  setShowUncertain(false);
                }}
              />
              <span>{s.groups[g]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div aria-live="polite" aria-busy={st.loading} className="flex flex-col gap-3">
        {firstLoad && (
          <ul className="grid gap-3 lg:grid-cols-2" aria-label={s.loading}>
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="bg-card flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="size-11 shrink-0 rounded-full" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-3 w-4/5" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                </div>
                <Skeleton className="h-10 w-full" />
              </li>
            ))}
          </ul>
        )}

        {people.length > 0 && (
          <ul className="grid gap-3 lg:grid-cols-2">
            {people.map((p) => (
              <li key={p.key}>
                <Card person={p} saved={saved.has(p.key)} {...cardProps} />
              </li>
            ))}
          </ul>
        )}

        {!st.loading && !st.status && st.page >= 0 && people.length === 0 && uncertain.length === 0 && (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">{s.empty}</p>
        )}

        {uncertain.length > 0 && (
          <div className="flex flex-col gap-3">
            <Button variant="ghost" className="self-start" onClick={() => setShowUncertain((v) => !v)}>
              {showUncertain ? s.hideUncertain : s.showUncertain.replace("{n}", String(uncertain.length))}
            </Button>
            {showUncertain && (
              <ul className="grid gap-3 lg:grid-cols-2">
                {uncertain.map((p) => (
                  <li key={p.key}>
                    <Card person={p} saved={saved.has(p.key)} {...cardProps} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {st.status && (
          <div
            className={cn(
              "flex flex-col gap-3 rounded-lg border p-4 text-sm",
              blocked ? "bg-caution-soft" : "bg-muted/40",
            )}
            role="status"
          >
            <p>{statusText[st.status]}</p>
            <div className="flex flex-wrap gap-2">
              {(st.status === "error" || st.status === "rate_limited" || st.status === "not_found") && (
                <Button variant="outline" size="sm" onClick={() => load(group, st.page + 1)}>
                  <RotateCw data-icon="inline-start" aria-hidden />
                  {s.retry}
                </Button>
              )}
              {cat && (
                <>
                  <Button asChild size="sm">
                    <a href={cat.linkedin} target="_blank" rel="noopener noreferrer">
                      <Search data-icon="inline-start" aria-hidden />
                      LinkedIn
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href={cat.google} target="_blank" rel="noopener noreferrer">
                      <Search data-icon="inline-start" aria-hidden />
                      Google
                    </a>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {!firstLoad && st.hasMore && !st.status && st.page >= 0 && (
          <Button
            variant="outline"
            className="self-center"
            disabled={st.loading}
            onClick={() => load(group, st.page + 1)}
          >
            {st.loading ? s.loading : s.loadMore}
          </Button>
        )}
      </div>

      <div className="text-muted-foreground flex flex-col gap-1 border-t pt-3 text-xs leading-relaxed">
        <p>{s.privacy}</p>
        <p className="flex flex-wrap justify-between gap-2 font-mono">
          <span>{st.fetchedAt ? s.cachedAt.replace("{date}", dateFmt.format(new Date(st.fetchedAt))) : ""}</span>
          <span>{s.attribution}</span>
        </p>
      </div>
    </section>
  );
}

function Card({
  person,
  company,
  jobId,
  category,
  message,
  saved,
  s,
  onRemoved,
  onSaved,
}: {
  person: PersonCard;
  company: { id: string; name: string };
  jobId?: string | null;
  lang: OutreachLang;
  category: ContactCategory;
  message?: OutreachMessage;
  saved: boolean;
  s: PeopleSearchStrings;
  onRemoved: (key: string) => void;
  onSaved: (key: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const note = message ? personalize(message.short, firstName(person.name)) : "";
  const uncertain = !person.companyMatch;

  const save = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("name", person.name);
      if (person.headline) fd.set("title", person.headline.slice(0, 160));
      fd.set("linkedinUrl", person.url);
      fd.set("category", category);
      fd.set("companyId", company.id);
      if (jobId) fd.set("jobId", jobId);
      const r = await addContact(undefined, fd);
      if (r?.ok) {
        onSaved(person.key);
        router.refresh();
      }
    });

  const suppress = (reason: "HIDDEN" | "REPORTED") =>
    start(async () => {
      const r = await suppressPerson(person.key, reason);
      if (r.ok) onRemoved(person.key);
    });

  return (
    <article className="bg-card flex h-full flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "font-heading flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            uncertain ? "bg-muted text-muted-foreground" : "bg-fit-soft text-fit",
          )}
        >
          {initials(person.name)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h4 className="font-heading leading-tight font-bold break-words" dir="auto">
            {person.name}
          </h4>
          {person.headline && (
            <span dir="auto" className="text-muted-foreground text-sm">
              <TruncatedText text={person.headline} lines={2} />
            </span>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{s.groups[person.group]}</Badge>
            {uncertain ? (
              <Badge variant="outline" className="bg-caution-soft text-caution border-transparent">
                {s.uncertain}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-fit-soft text-fit border-transparent">
                <Check aria-hidden />
                <span dir="auto">{s.verified.replace("{company}", company.name)}</span>
              </Badge>
            )}
            {person.location && (
              <span className="text-muted-foreground inline-flex min-w-0 items-center gap-1 text-xs" dir="auto">
                <MapPin aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">{person.location}</span>
              </span>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={s.more} className="-me-2 -mt-1 shrink-0">
              <MoreVertical aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => suppress("HIDDEN")}>
              <EyeOff aria-hidden />
              {s.hide}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => suppress("REPORTED")}>
              <Flag aria-hidden />
              {s.report}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-auto grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] lg:grid-cols-1">
        <Button asChild>
          <a href={person.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink data-icon="inline-start" aria-hidden />
            {s.openLinkedin}
          </a>
        </Button>
        <div className="grid grid-cols-2 gap-2 sm:contents lg:grid">
          {note && (
            <CopyButton text={note} label={s.copyNote} copiedLabel={s.copied} variant="outline" size="default" />
          )}
          <Button variant="ghost" disabled={saved || pending} onClick={save}>
            {saved ? <Check data-icon="inline-start" aria-hidden /> : <UserPlus data-icon="inline-start" aria-hidden />}
            {saved ? s.savedContact : pending ? s.saving : s.save}
          </Button>
        </div>
      </div>
    </article>
  );
}
