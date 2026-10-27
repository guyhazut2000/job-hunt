"use client";

import { useOptimistic, useTransition } from "react";
import type { ApplicationStatus } from "@prisma/client";
import { removeApplication, updateApplicationStatus } from "@/app/actions";

export interface KanbanItem {
  id: string;
  title: string;
  company: string;
  url: string | null;
  jobId: string | null;
  status: ApplicationStatus;
}

const COLUMNS: ApplicationStatus[] = ["SAVED", "APPLIED", "SCREENING", "INTERVIEW", "OFFER", "REJECTED"];

export function Kanban({
  items,
  labels,
  removeLabel,
}: {
  items: KanbanItem[];
  labels: Record<string, string>;
  removeLabel: string;
}) {
  const [, start] = useTransition();
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

  return (
    <div className="grid gap-3 overflow-x-auto md:grid-cols-3 xl:grid-cols-6">
      {COLUMNS.map((col) => (
        <section
          key={col}
          className="min-h-40 rounded-xl bg-slate-100 p-2"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => move(e.dataTransfer.getData("text/plain"), col)}
          aria-label={labels[col]}
        >
          <h2 className="mb-2 px-1 text-sm font-semibold text-slate-700">
            {labels[col]} <span className="text-slate-400">({optimistic.filter((i) => i.status === col).length})</span>
          </h2>
          <div className="space-y-2">
            {optimistic
              .filter((i) => i.status === col)
              .map((i) => (
                <div
                  key={i.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", i.id)}
                  className="cursor-grab rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm"
                >
                  <div className="font-medium">
                    {i.jobId ? (
                      <a href={`/jobs/${i.jobId}`} className="hover:underline">
                        {i.title}
                      </a>
                    ) : i.url ? (
                      <a href={i.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {i.title}
                      </a>
                    ) : (
                      i.title
                    )}
                  </div>
                  <div className="text-xs text-slate-500">{i.company}</div>
                  <div className="mt-2 flex items-center gap-1">
                    <select
                      aria-label="status"
                      className="input px-1 py-0.5 text-xs"
                      value={i.status}
                      onChange={(e) => move(i.id, e.target.value as ApplicationStatus)}
                    >
                      {COLUMNS.map((c) => (
                        <option key={c} value={c}>
                          {labels[c]}
                        </option>
                      ))}
                    </select>
                    <button
                      className="text-xs text-red-600 hover:underline"
                      title={removeLabel}
                      onClick={() =>
                        start(async () => {
                          setOptimistic({ id: i.id, remove: true });
                          await removeApplication(i.id);
                        })
                      }
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
