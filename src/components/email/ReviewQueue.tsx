"use client";

import { Check, ExternalLink, Mail, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveEmailCandidate, dismissEmailCandidate } from "@/app/email-actions";
import { Button } from "@/components/ui/button";
import type { ReviewItem } from "@/lib/email/review";
import type { EmailSyncStrings } from "@/lib/i18n/email-sync";

type Mode = "job" | "custom" | "app";

function ReviewCard({
  item,
  s,
  statusLabels,
}: {
  item: ReviewItem;
  s: EmailSyncStrings;
  statusLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const initialMode: Mode =
    item.kind === "STATUS_UPDATE" && item.appOptions.length
      ? "app"
      : item.jobOptions.length && item.defaultJobId
        ? "job"
        : "custom";
  const [mode, setMode] = useState<Mode>(initialMode);
  const modes: Mode[] = [
    ...(item.kind === "STATUS_UPDATE" && item.appOptions.length ? (["app"] as const) : []),
    ...(item.jobOptions.length ? (["job"] as const) : []),
    "custom",
  ];
  const modeLabel: Record<Mode, string> = {
    app: s.pickApp,
    job: item.kind === "STATUS_UPDATE" ? s.newApp : s.fromList,
    custom: s.customJob,
  };
  const tone = item.confidence >= 70 ? "text-fit" : item.confidence >= 50 ? "text-caution" : "text-muted-foreground";

  return (
    <li className="bg-card flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="chip">{item.kind === "APPLICATION" ? s.kindApp : s.kindStatus}</span>
        {item.kind === "STATUS_UPDATE" && item.detectedStatus && (
          <span className="chip font-semibold">→ {statusLabels[item.detectedStatus] ?? item.detectedStatus}</span>
        )}
        <span className={`font-mono font-semibold ${tone}`}>
          {s.confidenceLabel} {item.confidence}%
        </span>
        <span className="text-muted-foreground ms-auto">{item.dateLabel}</span>
      </div>
      <div className="min-w-0">
        <p className="font-semibold break-words">
          <bdi>{item.subject}</bdi>
        </p>
        <p className="text-muted-foreground flex items-center gap-1 truncate text-sm">
          <Mail className="size-3.5 shrink-0" aria-hidden />
          <bdi className="truncate">{item.sender}</bdi>
        </p>
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const res = await approveEmailCandidate(fd);
            setError(Boolean(res.error));
            if (!res.error) router.refresh();
          });
        }}
      >
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="mode" value={mode} />
        {modes.length > 1 && (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={s.matchTo}>
            {modes.map((m) => (
              <label key={m} className="toggle-chip min-h-9 px-3 text-xs">
                <input
                  type="radio"
                  className="sr-only"
                  name={`mode-${item.id}`}
                  checked={mode === m}
                  onChange={() => setMode(m)}
                />
                {modeLabel[m]}
              </label>
            ))}
          </div>
        )}
        {mode === "app" && (
          <select
            name="applicationId"
            className="select-native"
            defaultValue={item.defaultAppId ?? ""}
            required
            aria-label={s.pickApp}
          >
            <option value="" disabled>
              {s.pickApp}
            </option>
            {item.appOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        {mode === "job" && (
          <select
            name="jobId"
            className="select-native"
            defaultValue={item.defaultJobId ?? item.jobOptions[0]?.id}
            aria-label={s.matchTo}
          >
            {item.jobOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        {mode === "custom" && (
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="label text-xs" htmlFor={`t-${item.id}`}>
                {s.jobTitle}
              </label>
              <input
                id={`t-${item.id}`}
                name="title"
                className="input"
                defaultValue={item.title ?? ""}
                required
                maxLength={150}
              />
            </div>
            <div>
              <label className="label text-xs" htmlFor={`c-${item.id}`}>
                {s.company}
              </label>
              <input
                id={`c-${item.id}`}
                name="company"
                className="input"
                defaultValue={item.company ?? ""}
                required
                maxLength={100}
              />
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            <Check className="size-4" aria-hidden />
            {s.approve}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await dismissEmailCandidate(item.id);
                router.refresh();
              })
            }
          >
            <X className="size-4" aria-hidden />
            {s.dismiss}
          </Button>
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary ms-auto inline-flex min-h-9 items-center gap-1 text-sm font-semibold hover:underline"
          >
            {s.openEmail}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {s.errors.scan_failed}
          </p>
        )}
      </form>
    </li>
  );
}

export function ReviewQueue({
  items,
  s,
  statusLabels,
}: {
  items: ReviewItem[];
  s: EmailSyncStrings;
  statusLabels: Record<string, string>;
}) {
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {items.map((i) => (
        <ReviewCard key={i.id} item={i} s={s} statusLabels={statusLabels} />
      ))}
    </ul>
  );
}
