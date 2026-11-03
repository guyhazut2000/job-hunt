"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Send, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "@/components/outreach/CopyButton";
import { createReferral, draftReferralRequest, removeReferralContact } from "@/app/referrals/actions";
import { fillRef, type ReferralStrings } from "@/lib/i18n/referrals";
import type { ReferralLang } from "@/lib/referrals/message";
import type { ContactRow, TargetOption } from "./types";

export function InsiderContacts({
  s,
  contacts,
  targets,
  locale,
  initial,
}: {
  s: ReferralStrings;
  contacts: ContactRow[];
  targets: TargetOption[];
  locale: ReferralLang;
  /** Deep link from a job card / company page: ?contact=…&job=… */
  initial: { contactId: string | null; target: string | null };
}) {
  const [open, setOpen] = useState<string | null>(initial.contactId);
  if (!contacts.length)
    return (
      <p className="text-muted-foreground text-sm" data-testid="referral-contacts-empty">
        {s.contactsEmpty}
      </p>
    );
  return (
    <ul className="flex flex-col gap-3" data-testid="referral-contacts">
      {contacts.map((c) => (
        <li
          key={c.id}
          id={`contact-${c.id}`}
          className="bg-card flex scroll-mt-24 flex-col gap-2 rounded-lg border p-3"
          data-testid={`referral-contact-${c.id}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">
                <bdi>{c.name}</bdi>
                {c.title && (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    · <bdi>{c.title}</bdi>
                  </span>
                )}
              </p>
              <p className="text-sm">
                {c.companySlug ? (
                  <Link className="underline underline-offset-2" href={`/companies/${c.companySlug}`}>
                    <bdi>{c.companyName}</bdi>
                  </Link>
                ) : (
                  <>
                    <bdi>{c.companyName}</bdi> <span className="text-muted-foreground text-xs">({s.unmatched})</span>
                  </>
                )}
              </p>
              {c.relationship && (
                <p className="text-muted-foreground text-sm">
                  {s.relationship}: <bdi>{c.relationship}</bdi>
                </p>
              )}
              {c.linkedinUrl && (
                <a
                  href={c.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-muted-foreground inline-flex items-center gap-1 text-xs underline"
                >
                  LinkedIn <ExternalLink className="size-3" aria-hidden /> {s.external}
                </a>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                onClick={() => setOpen(open === c.id ? null : c.id)}
                data-testid={`referral-contact-${c.id}-request`}
              >
                <Send className="size-4" aria-hidden /> {s.requestBtn}
              </Button>
              <RemoveButton s={s} id={c.id} />
            </div>
          </div>
          {open === c.id && (
            <RequestPanel
              s={s}
              contact={c}
              targets={targets}
              locale={locale}
              initialTarget={initial.contactId === c.id ? initial.target : null}
              onClose={() => setOpen(null)}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function RemoveButton({ s, id }: { s: ReferralStrings; id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={s.deleteContact}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await removeReferralContact(id);
          router.refresh();
        })
      }
    >
      <Trash2 className="size-4" aria-hidden />
    </Button>
  );
}

function RequestPanel({
  s,
  contact,
  targets,
  locale,
  initialTarget,
  onClose,
}: {
  s: ReferralStrings;
  contact: ContactRow;
  targets: TargetOption[];
  locale: ReferralLang;
  initialTarget: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  // Jobs/applications at the contact's company first.
  const same = (t: TargetOption) =>
    (contact.companyId && t.companyId === contact.companyId) ||
    t.companyName.trim().toLowerCase() === contact.companyName.trim().toLowerCase();
  const options = [...targets.filter(same), ...targets.filter((t) => !same(t))];
  const [target, setTarget] = useState(
    initialTarget && options.some((o) => o.value === initialTarget) ? initialTarget : (options.find(same)?.value ?? ""),
  );
  const [lang, setLang] = useState<ReferralLang>(locale);
  const [draft, setDraft] = useState<{ body: string; source: string } | null>(null);
  const [tracked, setTracked] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest" });
  }, []);

  const pick = () => {
    const [kind, id] = target.split(":");
    return { applicationId: kind === "a" ? id : null, jobId: kind === "j" ? id : null };
  };
  const generate = () =>
    start(async () => {
      const res = await draftReferralRequest({ contactId: contact.id, lang, ...pick() });
      if ("body" in res) setDraft(res);
    });

  return (
    <div ref={ref} className="bg-muted/40 flex flex-col gap-3 rounded-md border p-3" data-testid="referral-request-panel">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold">{fillRef(s.draftTitle, { name: contact.name })}</h3>
        <Button size="icon" variant="ghost" aria-label={s.close} onClick={onClose}>
          <X className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-semibold">
          {s.draftFor}
          <select
            className="border-input bg-background h-9 min-w-0 rounded-md border px-2 text-sm"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            data-testid="referral-request-target"
          >
            <option value="">{s.draftGeneral}</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex flex-col gap-1 text-xs font-semibold">
          <legend className="mb-1">{s.lang}</legend>
          <div className="flex gap-1">
            {(["he", "en"] as const).map((l) => (
              <Button
                key={l}
                type="button"
                size="sm"
                variant={lang === l ? "default" : "outline"}
                aria-pressed={lang === l}
                onClick={() => setLang(l)}
                data-testid={`referral-request-lang-${l}`}
              >
                {l === "he" ? s.langHe : s.langEn}
              </Button>
            ))}
          </div>
        </fieldset>
        <Button onClick={generate} disabled={pending} data-testid="referral-request-generate">
          <Sparkles className="size-4" aria-hidden /> {draft ? s.regenerate : s.generate}
        </Button>
      </div>
      {draft && (
        <>
          <p className="text-muted-foreground text-xs" data-testid="referral-request-source">
            {draft.source === "ai" ? s.draftAi : draft.source === "limited" ? s.draftLimited : s.draftTemplate}
          </p>
          <Textarea
            value={draft.body}
            rows={8}
            dir={lang === "he" ? "rtl" : "ltr"}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            data-testid="referral-request-draft"
          />
          <div className="flex flex-wrap gap-2">
            <CopyButton text={draft.body} label={s.copy} copiedLabel={s.copied} />
            <Button
              variant="outline"
              disabled={pending || tracked}
              onClick={() =>
                start(async () => {
                  const res = await createReferral({ contactId: contact.id, ...pick() });
                  if ("ok" in res) {
                    setTracked(true);
                    router.refresh();
                  }
                })
              }
              data-testid="referral-request-mark-asked"
            >
              {tracked ? s.alreadyTracked : s.markAsked}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
