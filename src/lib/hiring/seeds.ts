/**
 * Curated, company-owned pages that describe a company's hiring process (docs/hiring-process.md).
 * Discovery tries these first; they are only hints — every stage is still grounded in the fetched text.
 * Only official pages (the company's own site / careers site / official blog). Never LinkedIn, Glassdoor,
 * Indeed or anything behind a login.
 */
export const HIRING_SEEDS: Record<string, string[]> = {
  "agoda-com": ["https://www.agoda.com/careers/how-we-hire"],
  "bio-rad-laboratories": ["https://careers.bio-rad.com/recruiting-process"],
  "booking-com": ["https://careers.booking.com/start-your-journey/"],
  datadog: ["https://careers.datadoghq.com/candidate-experience/"],
  dynatrace: ["https://www.dynatrace.com/careers/how-we-hire/"],
  elastic: ["https://www.elastic.co/careers/how-we-hire"],
  infineon: ["https://jobs.infineon.com/careers"],
  intuit: ["https://www.intuit.com/careers/hiring-process/"],
  "johnson-and-johnson": ["https://www.careers.jnj.com/en/how-we-hire/hiring-faqs"],
  merck: ["https://jobs.merck.com/hiring-process"],
  netafim: ["https://careers.netafim.com/pages/our-hiring-process"],
  nvidia: ["https://www.nvidia.com/en-us/about-nvidia/careers/how-we-hire/"],
  openweb: ["https://www.openweb.com/how-we-hire/"],
  "red-hat": ["https://www.redhat.com/en/jobs/info-guide"],
  salesforce: ["https://www.salesforce.com/company/careers/culture/how-we-hire/"],
  snowflake: ["https://careers.snowflake.com/us/en/gethired"],
  teva: ["https://www.tevapharm.com/your-career/how-we-hire/"],
  unity: ["https://unity.com/blog/news/want-to-work-at-unity-heres-how-our-hiring-process-works"],
  wolt: ["https://careers.wolt.com/en/how-we-hire"],
};
