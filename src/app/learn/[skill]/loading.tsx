import { Skeleton } from "@/components/ui/skeleton";

/** Shape-matched placeholder for a skill roadmap page. */
export default function SkillLoading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-5 w-32" />
      <div className="bg-card flex flex-col gap-5 rounded-2xl border p-5 sm:p-7">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-lg sm:size-20" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-48" />
          </div>
        </div>
        <Skeleton className="h-5 w-full max-w-2xl" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
        <Skeleton className="h-12 w-full max-w-sm rounded-xl" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-20 rounded-xl" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <Skeleton className="hidden h-48 rounded-xl lg:block" />
      </div>
    </div>
  );
}
