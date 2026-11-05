/** Manual queue vs drafts waiting on the user vs packets already approved. */

export type QueueBucket = "review" | "manual" | "done";

export function queueBucket(status: string): QueueBucket {
  if (status === "MANUAL") return "manual";
  if (status === "HANDED_OFF" || status === "SUBMITTED") return "done";
  return "review";
}

export function groupQueue<T extends { status: string }>(rows: readonly T[]): Record<QueueBucket, T[]> {
  return {
    review: rows.filter((r) => queueBucket(r.status) === "review"),
    manual: rows.filter((r) => queueBucket(r.status) === "manual"),
    done: rows.filter((r) => queueBucket(r.status) === "done"),
  };
}
