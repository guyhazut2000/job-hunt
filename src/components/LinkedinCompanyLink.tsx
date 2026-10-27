import { Briefcase, Building2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClickPlacement } from "@/lib/events";
import type { LinkedinStrings } from "@/lib/i18n/linkedin";
import { linkedinCompanyJobsUrl, linkedinCompanyLinkFor } from "@/lib/linkedin/company";
import { cn } from "@/lib/utils";
import { OutboundLink } from "./OutboundLink";

interface CompanyLike {
  id: string;
  name: string;
  linkedinUrl?: string | null;
}

const fill = (tpl: string, name: string) => tpl.replace("{name}", name);

/** Secondary button (job page): the company's LinkedIn page when stored, else a company search. */
export function LinkedinCompanyButton({
  company,
  jobId,
  s,
  placement = "page",
  className,
}: {
  company: CompanyLike;
  jobId?: string;
  s: LinkedinStrings;
  placement?: ClickPlacement;
  className?: string;
}) {
  const link = linkedinCompanyLinkFor(company);
  const page = link.kind === "company_page";
  const Icon = page ? Building2 : Search;
  return (
    <Button asChild variant="outline" size="lg" className={cn("w-full", className)}>
      <OutboundLink
        href={link.url}
        event="company_linkedin_click"
        kind={link.kind}
        companyId={company.id}
        jobId={jobId}
        placement={placement}
        aria-label={fill(page ? s.companyPageAria : s.companySearchAria, company.name)}
        data-linkedin-company-link={link.kind}
      >
        {page ? s.companyPage : s.companySearch}
        <Icon data-icon="inline-end" aria-hidden />
      </OutboundLink>
    </Button>
  );
}

const textLink =
  "text-primary inline-flex min-h-11 items-center gap-1 font-semibold underline-offset-4 hover:underline";

/** Company page header: company page/search + company jobs search (Israel). */
export function LinkedinCompanyLinks({ company, s }: { company: CompanyLike; s: LinkedinStrings }) {
  const link = linkedinCompanyLinkFor(company);
  const page = link.kind === "company_page";
  return (
    <>
      <OutboundLink
        href={link.url}
        event="company_linkedin_click"
        kind={link.kind}
        companyId={company.id}
        placement="header"
        aria-label={fill(page ? s.companyPageAria : s.companySearchAria, company.name)}
        data-linkedin-company-link={link.kind}
        className={textLink}
      >
        {page ? s.companyPage : s.companySearch}
        {page ? <Building2 className="size-3.5" aria-hidden /> : <Search className="size-3.5" aria-hidden />}
      </OutboundLink>
      <OutboundLink
        href={linkedinCompanyJobsUrl(company.name)}
        event="company_linkedin_click"
        kind="company_jobs"
        companyId={company.id}
        placement="header"
        aria-label={fill(s.companyJobsAria, company.name)}
        data-linkedin-company-link="company_jobs"
        className={textLink}
      >
        {s.companyJobs}
        <Briefcase className="size-3.5" aria-hidden />
      </OutboundLink>
    </>
  );
}

/** Compact "in" icon for company cards (sibling of the card link, never nested inside it). */
export function LinkedinCompanyIcon({ company, s }: { company: CompanyLike; s: LinkedinStrings }) {
  const link = linkedinCompanyLinkFor(company);
  const label = fill(s.companyIconAria, company.name);
  return (
    <OutboundLink
      href={link.url}
      event="company_linkedin_click"
      kind={link.kind}
      companyId={company.id}
      placement="list"
      aria-label={label}
      title={label}
      data-linkedin-company-link={link.kind}
      className="text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:bg-muted grid w-11 shrink-0 place-items-center border-s transition-colors"
    >
      <span
        aria-hidden
        className="grid size-6 place-items-center rounded-[4px] border border-current font-sans text-[0.8rem] leading-none font-bold"
      >
        in
      </span>
    </OutboundLink>
  );
}
