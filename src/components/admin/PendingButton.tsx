"use client";

import { useFormStatus } from "react-dom";

/** Submit button that shows it's working while its (possibly long) server action runs. */
export function PendingButton({
  children,
  pendingLabel,
  className = "btn-ghost",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`${className} min-h-11`} disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
