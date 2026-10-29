"use client";

import { useOptimistic, useRef, useTransition } from "react";
import { InterviewDate, type InterviewDateLabels } from "./InterviewDate";
import { TruncatedText } from "./TruncatedText";
import type { ApplicationStatus } from "@prisma/client";
import { ExternalLink, GripVertical, Trash2, Users } from "lucide-react";
import { removeApplication, updateApplicationStatus } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface KanbanItem {
  id: string;
  title: string;
  company: string;
  url: string | null;
  jobId: string | null;
  status: ApplicationStatus;
  /** Saved outreach contacts for this job (referral tracking). */
  contacts?: { total: number; referred: number };
  /** Interview date (Israel wall time for the input + a formatted label), when set. */
  interview?: { value: string; display: string; note: string | null } | null;
}

const COLUMNS: ApplicationStatus[] = ["SAVED", "APPLIED", "SCREENING", "INTERVIEW", "OFFER", "REJECTED"];
const ACCENT: Record<ApplicationStatus, string> = {
  SAVED: "bg-muted-foreground",
  APPLIED: "bg-foreground",
  SCREENING: "bg-caution",
  INTERVIEW: "bg-primary",
  OFFER: "bg-fit",
  REJECTED: "bg-border",
};

export function Kanban({
  items,
  labels,
  removeLabel,
  statusLabel,
  emptyLabel,
  contactsLabel,
  interviewLabels,
}: {
  items: KanbanItem[];
  labels: Record<string, string>;
  removeLabel: string;
  statusLabel: string;
  emptyLabel: string;
  contactsLabel?: { count: string; referred: string };
  interviewLabels?: InterviewDateLabels;
}) {
  const [, start] = useTransition();
  const board = useRef<HTMLDivElement>(null);
  const [optimistic, setOptimistic] = useOptimistic(
    items,
    (state, u: { id: string; status?: ApplicationStatus; remove?: boolean }) =>
      u.remove
        ? state.filter((i) => i.id !== u.id)
        : state.map((i) => (i.id === u.id ? { ...i, status: u.status! } : i)),
  );
  const move = (id: string, status: ApplicationStatus) =>
    start(async () => {
      setOptimistic({ id, status });
      await updateApplicationStatus(id, status);
    });
  const counts = Object.fromEntries(COLUMNS.map((c) => [c, optimistic.filter((i) => i.status === c).length]));
  const jump = (col: ApplicationStatus) =>
    board.current
      ?.querySelector(`[data-col="${col}"]`)
      ?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });

  return (
    <div className="flex flex-col gap-3">
      {/* status index — doubles as a column jumper on small screens */}
      <div className="scroll-thin -mx-4 overflow-x-auto px-4 xl:hidden">
        <ul className="flex w-max gap-1.5">
          {COLUMNS.map((c) => (
            <li key={c}>
              <button
                type="button"
                onClick={() => jump(c)}
                className="bg-card hover:bg-muted inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold"
              >
                <span aria-hidden className={cn("size-2 rounded-full", ACCENT[c])} />
                {labels[c]}
                <span className="text-muted-foreground font-mono text-xs">{counts[c]}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div
        ref={board}
        className="scroll-thin -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-3 xl:mx-0 xl:grid xl:grid-cols-6 xl:overflow-visible xl:px-0"
      >
        {COLUMNS.map((col) => (
          <section
            key={col}
            data-col={col}
            className="bg-secondary/60 flex min-h-48 w-[82vw] max-w-80 shrink-0 snap-start flex-col gap-2 rounded-lg p-2 sm:w-72 xl:w-auto xl:max-w-none"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => move(e.dataTransfer.getData("text/plain"), col)}
            aria-labelledby={`col-${col}`}
          >
            <h2 id={`col-${col}`} className="flex items-center gap-2 px-1.5 pt-1 text-sm font-bold">
              <span aria-hidden className={cn("size-2 rounded-full", ACCENT[col])} />
              {labels[col]}
              <span className="text-muted-foreground ms-auto font-mono text-xs">{counts[col]}</span>
            </h2>
            {counts[col] === 0 && (
              <p className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-xs">
                {emptyLabel}
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {optimistic
                .filter((i) => i.status === col)
                .map((i) => {
                  const href = i.jobId ? `/jobs/${i.jobId}` : i.url;
                  return (
                    <li
                      key={i.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", i.id)}
                      className="bg-card flex flex-col gap-2 rounded-md border p-3 shadow-[0_1px_0_var(--border)]"
                    >
                      <div className="flex items-start gap-1.5">
                        <GripVertical
                          className="text-muted-foreground mt-0.5 hidden size-4 shrink-0 cursor-grab xl:block"
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-heading leading-snug font-bold" dir="auto">
                            {href ? (
                              <a
                                href={href}
                                {...(i.jobId ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                                className="hover:text-primary -my-2 flex items-start gap-1 py-2 underline-offset-4 hover:underline"
                              >
                                <TruncatedText text={i.title} lines={3} className="min-w-0" />
                                {!i.jobId && <ExternalLink className="mt-1.5 size-3 shrink-0" aria-hidden />}
                              </a>
                            ) : (
                              <TruncatedText text={i.title} lines={3} />
                            )}
                          </p>
                          <TruncatedText text={i.company} side="bottom" className="text-muted-foreground text-sm" />
                          {contactsLabel && i.contacts && i.contacts.total > 0 && (
                            <p className="text-foreground/80 mt-1 flex items-center gap-1 text-xs font-semibold">
                              <Users className="size-3.5 shrink-0" aria-hidden />
                              {contactsLabel.count.replace("{n}", String(i.contacts.total))}{" "}
                              {i.contacts.referred > 0 && (
                                <span className="text-fit">
                                  · {i.contacts.referred} {contactsLabel.referred}
                                </span>
                              )}
                            </p>
                          )}
                          {interviewLabels && (i.status === "INTERVIEW" || i.interview) && (
                            <div className="mt-1">
                              <InterviewDate
                                applicationId={i.id}
                                title={i.title}
                                value={i.interview?.value ?? ""}
                                note={i.interview?.note ?? null}
                                display={i.interview?.display ?? null}
                                labels={interviewLabels}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <select
                          aria-label={`${statusLabel}: ${i.title}`}
                          className="select-native min-h-11 flex-1 py-1 text-sm xl:min-h-9"
                          value={i.status}
                          onChange={(e) => move(i.id, e.target.value as ApplicationStatus)}
                        >
                          {COLUMNS.map((c) => (
                            <option key={c} value={c}>
                              {labels[c]}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive xl:size-9"
                          aria-label={`${removeLabel}: ${i.title}`}
                          onClick={() =>
                            start(async () => {
                              setOptimistic({ id: i.id, remove: true });
                              await removeApplication(i.id);
                            })
                          }
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
