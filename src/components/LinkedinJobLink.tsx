import { ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LinkedinStrings } from "@/lib/i18n/linkedin";
import type { ClickPlacement } from "@/lib/events";
import { cn } from "@/lib/utils";
import { OutboundLink } from "./OutboundLink";

export interface LinkedinLink {
  kind: "exact" | "search";
  url: string;
}

/** Secondary LinkedIn link: the exact posting when Brave found one, otherwise a clearly-labelled search. */
export function LinkedinJobButton({
  link,
  jobId,
  s,
  placement = "page",
  className,
}: {
  link: LinkedinLink;
  jobId: string;
  s: LinkedinStrings;
  placement?: ClickPlacement;
  className?: string;
}) {
  const exact = link.kind === "exact";
  const Icon = exact ? ExternalLink : Search;
  return (
    <div className={cn("flex flex-col gap-1", className)} data-linkedin-link={link.kind}>
      <Button asChild variant="outline" size="lg" className="w-full">
        <OutboundLink
          href={link.url}
          event="job_linkedin_click"
          kind={link.kind}
          jobId={jobId}
          placement={placement}
          aria-label={exact ? s.exactAria : s.searchAria}
        >
          {exact ? s.exact : s.search}
          <Icon data-icon="inline-end" aria-hidden />
        </OutboundLink>
      </Button>
      <p className="text-muted-foreground text-center text-xs">{exact ? s.exactNote : s.searchNote}</p>
    </div>
  );
}

/** Compact variant for job cards; sits above the card-wide link overlay. */
export function LinkedinJobInlineLink({ link, jobId, s }: { link: LinkedinLink; jobId: string; s: LinkedinStrings }) {
  const exact = link.kind === "exact";
  const Icon = exact ? ExternalLink : Search;
  return (
    <OutboundLink
      href={link.url}
      event="job_linkedin_click"
      kind={link.kind}
      jobId={jobId}
      placement="card"
      aria-label={exact ? s.exactAria : s.searchAria}
      data-linkedin-link={link.kind}
      className="text-muted-foreground hover:text-foreground relative z-10 -my-2 inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline sm:min-h-0 sm:py-2"
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {exact ? s.exactShort : s.searchShort}
      {exact && <span className="chip px-1.5 py-0 text-[0.7rem] font-semibold">{s.exactNote}</span>}
    </OutboundLink>
  );
}
