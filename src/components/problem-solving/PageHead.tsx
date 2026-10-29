import { Puzzle } from "lucide-react";

export function PageHead({
  kicker,
  title,
  lead,
  children,
}: {
  kicker: string;
  title: string;
  lead: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="motion-safe:animate-rise flex flex-col gap-3">
      <p className="kicker inline-flex items-center gap-1.5">
        <Puzzle className="size-3.5" aria-hidden />
        {kicker}
      </p>
      <h1 className="text-title font-black">{title}</h1>
      <p className="text-foreground/80 max-w-[65ch] leading-relaxed">{lead}</p>
      {children}
    </header>
  );
}
