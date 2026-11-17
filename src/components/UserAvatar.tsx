"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Round avatar: the user's image when there is one, otherwise their initials. */
export function UserAvatar({
  image,
  initials,
  className,
}: {
  image: string | null;
  initials: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <span
      aria-hidden
      data-testid="user-avatar"
      className={cn(
        "bg-primary/12 text-primary ring-primary/25 grid size-8 shrink-0 place-items-center overflow-hidden rounded-full text-[0.8rem] leading-none font-bold ring-1",
        className,
      )}
    >
      {image && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- any user image host; tiny avatar
        <img
          src={image}
          alt=""
          className="size-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        <span dir="auto">{initials}</span>
      )}
    </span>
  );
}
