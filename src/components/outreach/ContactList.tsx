"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import type { ContactCategory, ContactStatus } from "@prisma/client";
import { ExternalLink, Trash2 } from "lucide-react";
import { deleteContact, updateContactStatus } from "@/app/outreach/actions";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

export interface ContactRow {
  id: string;
  name: string;
  title: string | null;
  linkedinUrl: string | null;
  category: ContactCategory;
  status: ContactStatus;
  notes: string | null;
  /** Where this contact belongs (shown on the dashboard). */
  context?: { label: string; href: string } | null;
}

const STATUSES: ContactStatus[] = ["NOT_CONTACTED", "SENT", "REPLIED", "REFERRED"];
export const STATUS_DOT: Record<ContactStatus, string> = {
  NOT_CONTACTED: "bg-border",
  SENT: "bg-foreground",
  REPLIED: "bg-caution",
  REFERRED: "bg-fit",
};

export function ContactList({ contacts, t }: { contacts: ContactRow[]; t: Dictionary["people"] }) {
  const [, start] = useTransition();
  const [items, apply] = useOptimistic(
    contacts,
    (state, u: { id: string; status?: ContactStatus; remove?: boolean }) =>
      u.remove
        ? state.filter((c) => c.id !== u.id)
        : state.map((c) => (c.id === u.id ? { ...c, status: u.status! } : c)),
  );
  if (items.length === 0) return null;
  return (
    <ul className="bg-card divide-border flex flex-col divide-y rounded-lg border">
      {items.map((c) => (
        <li key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[c.status])} />
              {c.linkedinUrl ? (
                <a
                  href={c.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-heading hover:text-primary inline-flex min-h-11 items-center gap-1 font-bold break-words underline-offset-4 hover:underline sm:min-h-0"
                  aria-label={`${c.name} — ${t.openProfile}`}
                  dir="auto"
                >
                  {c.name}
                  <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                </a>
              ) : (
                <span className="font-heading font-bold break-words" dir="auto">
                  {c.name}
                </span>
              )}
              <span className="chip">{t.categories[c.category]}</span>
            </p>
            {c.title && (
              <p className="text-muted-foreground text-sm break-words" dir="auto">
                {c.title}
              </p>
            )}
            {c.context && (
              <p className="text-sm">
                <span className="text-muted-foreground">{t.forJob}: </span>
                <Link
                  href={c.context.href}
                  className="hover:text-primary font-semibold underline-offset-4 hover:underline"
                  dir="auto"
                >
                  {c.context.label}
                </Link>
              </p>
            )}
            {c.notes && (
              <p className="text-foreground/80 text-sm whitespace-pre-line" dir="auto">
                {c.notes}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:w-52">
            <select
              aria-label={`${t.status}: ${c.name}`}
              className="select-native min-h-11 flex-1 py-1 text-sm"
              value={c.status}
              onChange={(e) => {
                const status = e.target.value as ContactStatus;
                start(async () => {
                  apply({ id: c.id, status });
                  await updateContactStatus(c.id, status);
                });
              }}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.statuses[s]}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              aria-label={`${t.remove}: ${c.name}`}
              onClick={() =>
                start(async () => {
                  apply({ id: c.id, remove: true });
                  await deleteContact(c.id);
                })
              }
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
