"use client";

import { useTransition } from "react";
import { saveJob } from "@/app/actions";

export function SaveJobButton({
  jobId,
  saved,
  label,
  savedLabel,
}: {
  jobId: string;
  saved: boolean;
  label: string;
  savedLabel: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button className="btn-ghost" disabled={saved || pending} onClick={() => start(() => saveJob(jobId))}>
      {saved ? `✓ ${savedLabel}` : label}
    </button>
  );
}
