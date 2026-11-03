"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleAlert } from "lucide-react";

const HIDDEN = ["/cv/standard", "/onboarding", "/login", "/register"];

export function BannerShell({ text, cta }: { text: string; cta: string }) {
  const path = usePathname() ?? "";
  if (HIDDEN.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return (
    <div
      role="status"
      data-testid="cv-standard-banner"
      className="border-caution/40 bg-caution/10 mx-auto mt-3 flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 rounded-md border px-4 py-2 text-sm md:px-6"
    >
      <span className="flex items-center gap-2">
        <CircleAlert aria-hidden className="text-caution size-4 shrink-0" />
        {text}
      </span>
      <Link href="/cv/standard" className="text-primary inline-flex min-h-10 items-center font-semibold underline underline-offset-4">
        {cta}
      </Link>
    </div>
  );
}
