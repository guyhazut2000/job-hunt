"use client";

import { useCallback, useId, useState, useTransition } from "react";
import type { ContactCategory } from "@prisma/client";
import { ChevronDown, Search, Sparkles, UserPlus } from "lucide-react";
import { draftOutreach } from "@/app/outreach/actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { personalize, SHORT_LIMIT, type OutreachLang, type OutreachMessage } from "@/lib/outreach/messages";
import { cn } from "@/lib/utils";
import { ContactForm } from "./ContactForm";
import { ContactList, type ContactRow } from "./ContactList";
import { CopyButton } from "./CopyButton";

export interface PeopleCategoryItem {
  category: ContactCategory;
  linkedin: string;
  google: string;
  /** Domain label for team-scoped categories, e.g. "Backend". */
  domain: string | null;
  messages: Record<OutreachLang, OutreachMessage>;
}

export function PeopleSection({
  company,
  jobId,
  items,
  contacts,
  loggedIn,
  canAi,
  defaultLang,
  t,
}: {
  company: { id: string; name: string };
  jobId?: string | null;
  items: PeopleCategoryItem[];
  contacts: ContactRow[];
  loggedIn: boolean;
  canAi: boolean;
  defaultLang: OutreachLang;
  t: Dictionary["people"];
}) {
  const uid = useId();
  const [lang, setLang] = useState<OutreachLang>(defaultLang);
  const [name, setName] = useState("");
  const [ai, setAi] = useState<Record<string, OutreachMessage>>({});
  const [formFor, setFormFor] = useState<ContactCategory | null>(null);
  const closeForm = useCallback(() => setFormFor(null), []);

  return (
    <section aria-labelledby={`${uid}-h`} className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <p className="kicker">{t.kicker}</p>
        <h2 id={`${uid}-h`} className="font-heading text-2xl font-bold break-words" dir="auto">
          {t.title.replace("{company}", company.name)}
        </h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">{t.intro}</p>
      </header>

      <div className="bg-card flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="label" htmlFor={`${uid}-name`}>
            {t.recipient}
          </label>
          <input
            id={`${uid}-name`}
            className="input"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.recipientHint}
            dir="auto"
            autoComplete="off"
          />
        </div>
        <fieldset className="flex flex-col gap-1">
          <legend className="label">{t.language}</legend>
          <div className="flex gap-2">
            {(["he", "en"] as const).map((l) => (
              <label key={l} className="toggle-chip">
                <input
                  type="radio"
                  className="sr-only"
                  name={`${uid}-lang`}
                  value={l}
                  checked={lang === l}
                  onChange={() => setLang(l)}
                />
                <span lang={l}>{l === "he" ? "עברית" : "English"}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <ul className="flex flex-col gap-3">
        {items.map((item, i) => (
          <li key={item.category}>
            <CategoryCard
              item={item}
              lang={lang}
              name={name}
              open={i === 0}
              ai={ai[`${item.category}:${lang}`]}
              onAi={(m) => setAi((s) => ({ ...s, [`${item.category}:${lang}`]: m }))}
              companyId={company.id}
              jobId={jobId}
              loggedIn={loggedIn}
              canAi={canAi}
              onSave={() => setFormFor(item.category)}
              t={t}
            />
          </li>
        ))}
      </ul>

      {loggedIn ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-heading text-lg font-bold">{t.contacts}</h3>
            <Button variant="outline" onClick={() => setFormFor(items[0]?.category ?? "RECRUITER")}>
              <UserPlus data-icon="inline-start" aria-hidden />
              {t.saveContact}
            </Button>
          </div>
          {contacts.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">{t.contactsEmpty}</p>
          ) : (
            <ContactList contacts={contacts} t={t} />
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">{t.loginHint}</p>
      )}

      <Sheet open={formFor !== null} onOpenChange={(o) => !o && closeForm()}>
        <SheetContent side="bottom" className="mx-auto w-full max-w-lg rounded-t-xl pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle>{t.saveContact}</SheetTitle>
            <SheetDescription dir="auto">{company.name}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {formFor && (
              <ContactForm companyId={company.id} jobId={jobId} category={formFor} t={t} onSaved={closeForm} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}

function CategoryCard({
  item,
  lang,
  name,
  open,
  ai,
  onAi,
  companyId,
  jobId,
  loggedIn,
  canAi,
  onSave,
  t,
}: {
  item: PeopleCategoryItem;
  lang: OutreachLang;
  name: string;
  open: boolean;
  ai?: OutreachMessage;
  onAi: (m: OutreachMessage) => void;
  companyId: string;
  jobId?: string | null;
  loggedIn: boolean;
  canAi: boolean;
  onSave: () => void;
  t: Dictionary["people"];
}) {
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const msg = ai ?? item.messages[lang];
  const short = personalize(msg.short, name);
  const long = personalize(msg.long, name);
  const over = short.length > SHORT_LIMIT;
  const dir = lang === "he" ? "rtl" : "ltr";
  const hint = t.hints[item.category].replace("{domain}", item.domain ? t.domain.replace("{domain}", item.domain) : "");

  return (
    <details open={open} className="group bg-card rounded-lg border open:shadow-sm">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-heading font-bold break-words">{t.categories[item.category]}</span>
          <span className="text-muted-foreground text-sm break-words">{hint}</span>
        </span>
        <ChevronDown
          aria-hidden
          className="text-muted-foreground size-5 shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="flex flex-col gap-4 border-t px-4 pt-4 pb-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button asChild>
            <a href={item.linkedin} target="_blank" rel="noopener noreferrer">
              <Search data-icon="inline-start" aria-hidden />
              {t.searchLinkedin}
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={item.google} target="_blank" rel="noopener noreferrer">
              <Search data-icon="inline-start" aria-hidden />
              {t.searchGoogle}
            </a>
          </Button>
        </div>

        <Tabs defaultValue="short" className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="short">{t.short}</TabsTrigger>
              <TabsTrigger value="long">{t.long}</TabsTrigger>
            </TabsList>
            <span className="text-muted-foreground font-mono text-xs">
              {msg.source === "ai" ? t.aiBadge : t.templateBadge}
            </span>
          </div>
          <TabsContent value="short" className="flex flex-col gap-2">
            <MessageText text={short} dir={dir} lang={lang} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={cn("font-mono text-xs", over ? "text-destructive font-bold" : "text-muted-foreground")}
                aria-live="polite"
              >
                {short.length}/{SHORT_LIMIT}
              </span>
              <CopyButton text={short} label={t.copy} copiedLabel={t.copied} />
            </div>
            {over && <p className="text-destructive text-sm">{t.tooLong}</p>}
          </TabsContent>
          <TabsContent value="long" className="flex flex-col gap-2">
            <div className="bg-muted/50 flex items-center gap-2 rounded-md px-3 py-2 text-sm">
              <span className="text-muted-foreground shrink-0">{t.subject}:</span>
              <span className="min-w-0 flex-1 font-semibold break-words" dir={dir} lang={lang}>
                {msg.subject}
              </span>
              <CopyButton text={msg.subject} label={t.copySubject} copiedLabel={t.copied} variant="ghost" iconOnly />
            </div>
            <MessageText text={long} dir={dir} lang={lang} />
            <div className="flex justify-end">
              <CopyButton text={long} label={t.copy} copiedLabel={t.copied} />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap gap-2">
          {canAi && (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setFailed(false);
                  const r = await draftOutreach({ companyId, jobId, category: item.category, lang });
                  if ("error" in r || r.source !== "ai") setFailed(true);
                  else onAi(r);
                })
              }
            >
              <Sparkles data-icon="inline-start" aria-hidden />
              {pending ? t.aiBusy : t.ai}
            </Button>
          )}
          {loggedIn && (
            <Button variant="ghost" onClick={onSave}>
              <UserPlus data-icon="inline-start" aria-hidden />
              {t.saveContact}
            </Button>
          )}
        </div>
        {failed && (
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {t.aiFailed}
          </p>
        )}
      </div>
    </details>
  );
}

function MessageText({ text, dir, lang }: { text: string; dir: "rtl" | "ltr"; lang: OutreachLang }) {
  return (
    <p
      dir={dir}
      lang={lang}
      className="bg-muted/40 max-h-[50dvh] overflow-y-auto overscroll-contain rounded-md border p-3 text-sm leading-relaxed break-words whitespace-pre-wrap"
    >
      {text}
    </p>
  );
}
