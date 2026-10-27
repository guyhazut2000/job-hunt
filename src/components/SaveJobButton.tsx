"use client";

import { useTransition } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { saveJob } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function SaveJobButton({
  jobId,
  saved,
  label,
  savedLabel,
  compact,
}: {
  jobId: string;
  saved: boolean;
  label: string;
  savedLabel: string;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const Icon = saved ? BookmarkCheck : Bookmark;
  return (
    <Button
      variant="outline"
      size={compact ? "icon-lg" : "lg"}
      disabled={saved || pending}
      aria-label={compact ? (saved ? savedLabel : label) : undefined}
      aria-pressed={saved}
      onClick={() => start(() => saveJob(jobId))}
    >
      <Icon data-icon={compact ? undefined : "inline-start"} aria-hidden />
      {!compact && (saved ? savedLabel : label)}
    </Button>
  );
}
