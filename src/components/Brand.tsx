import Link from "next/link";

export function Brand({ tagline }: { tagline?: string }) {
  return (
    <Link href="/" className="group flex min-h-11 items-center gap-2.5" aria-label="job-hunt">
      <span
        aria-hidden
        className="bg-foreground text-background grid size-8 place-items-center rounded-[3px] font-mono text-[0.8rem] font-medium tracking-tighter transition-transform group-hover:-rotate-6"
      >
        jh<span className="text-primary">.</span>
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-heading text-xl font-black tracking-tight" dir="ltr">
          job-hunt
        </span>
        {tagline && <span className="kicker mt-1 hidden lg:block">{tagline}</span>}
      </span>
    </Link>
  );
}
