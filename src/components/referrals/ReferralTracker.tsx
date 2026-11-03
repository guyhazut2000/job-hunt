"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Trash2 } from "lucide-react";
import type { ReferralStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteReferral, updateReferral } from "@/app/referrals/actions";
import { fillRef, type ReferralStrings } from "@/lib/i18n/referrals";
import type { ReferralRow } from "./types";

const STATUSES: ReferralStatus[] = ["ASKED", "AGREED", "SUBMITTED", "ANSWERED", "DECLINED"];
const DAY = 86_400_000;

export function ReferralTracker({
  s,
  rows,
  apps,
  now,
}: {
  s: ReferralStrings;
  rows: ReferralRow[];
  apps: Array<{ id: string; label: string }>;
  now: string;
}) {
  if (!rows.length)
    return (
      <p className="text-muted-foreground text-sm" data-testid="referral-tracker-empty">
        {s.trackerEmpty}
      </p>
    );
  return (
    <ul className="flex flex-col gap-3" data-testid="referral-tracker">
      {rows.map((r) => (
        <TrackerItem key={r.id} s={s} r={r} apps={apps} now={now} />
      ))}
    </ul>
  );
}

function TrackerItem({
  s,
  r,
  apps,
  now,
}: {
  s: ReferralStrings;
  r: ReferralRow;
  apps: Array<{ id: string; label: string }>;
  now: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState(r.note ?? "");
  const days = Math.max(0, Math.floor((new Date(now).getTime() - new Date(r.statusAt).getTime()) / DAY));
  const run = (patch: Parameters<typeof updateReferral>[0]) =>
    start(async () => {
      await updateReferral(patch);
      router.refresh();
    });
  const dueText = r.due
    ? fillRef(
        r.due.kind === "ask_again" ? s.dueAskAgain : r.due.kind === "send_cv" ? s.dueSendCv : s.dueAskAnswer,
        { days: r.due.days },
      )
    : null;

  return (
    <li
      id={`referral-${r.id}`}
      className="bg-card flex scroll-mt-24 flex-col gap-2 rounded-lg border p-3"
      data-testid={`referral-${r.id}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          <bdi>{r.contactName}</bdi> · <bdi>{r.company}</bdi>
          {r.jobTitle && (
            <span className="text-muted-foreground font-normal">
              {" "}
              · <bdi>{r.jobTitle}</bdi>
            </span>
          )}
        </p>
        <span className="text-muted-foreground text-xs">{fillRef(s.since, { days })}</span>
      </div>
      {dueText && (
        <p
          className="flex items-start gap-2 rounded-md border border-amber-600/30 bg-amber-500/10 p-2 text-sm"
          data-testid={`referral-${r.id}-due`}
        >
          <BellRing className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
          <span className="flex-1">{dueText}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run({ id: r.id, followedUp: true })}
            data-testid={`referral-${r.id}-followed`}
          >
            {s.markFollowedUp}
          </Button>
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold">
          {s.status}
          <select
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            value={r.status}
            disabled={pending}
            onChange={(e) => run({ id: r.id, status: e.target.value as ReferralStatus })}
            data-testid={`referral-${r.id}-status`}
          >
            {STATUSES.map((st) => (
              <option key={st} value={st}>
                {s.statusLabels[st]}
              </option>
            ))}
          </select>
        </label>
        {r.status === "ANSWERED" && (
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {s.outcome}
            <select
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
              value={r.outcome ?? ""}
              disabled={pending}
              onChange={(e) => run({ id: r.id, outcome: e.target.value as "positive" | "negative" | "" })}
              data-testid={`referral-${r.id}-outcome`}
            >
              <option value="">{s.outcomeUnknown}</option>
              <option value="positive">{s.outcomePositive}</option>
              <option value="negative">{s.outcomeNegative}</option>
            </select>
          </label>
        )}
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-semibold">
          {s.application}
          <select
            className="border-input bg-background h-9 min-w-0 rounded-md border px-2 text-sm"
            value={r.applicationId ?? ""}
            disabled={pending}
            onChange={(e) => run({ id: r.id, applicationId: e.target.value || null })}
            data-testid={`referral-${r.id}-app`}
          >
            <option value="">{s.noApplication}</option>
            {apps.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={note}
          maxLength={1000}
          dir="auto"
          placeholder={s.note}
          aria-label={s.note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== (r.note ?? "") && run({ id: r.id, note })}
        />
        <Button
          size="icon"
          variant="ghost"
          aria-label={s.remove}
          disabled={pending}
          onClick={() =>
            start(async () => {
              await deleteReferral(r.id);
              router.refresh();
            })
          }
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
    </li>
  );
}
