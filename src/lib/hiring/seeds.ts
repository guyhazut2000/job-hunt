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
  crowdstrike: ["https://www.crowdstrike.com/en-us/careers/interviewing/"],
  datadog: ["https://careers.datadoghq.com/candidate-experience/"],
  dynatrace: ["https://www.dynatrace.com/careers/how-we-hire/"],
  elastic: ["https://www.elastic.co/careers/how-we-hire"],
  gitlab: ["https://handbook.gitlab.com/handbook/hiring/candidate-faq/"],
  infineon: ["https://jobs.infineon.com/careers"],
  intuit: ["https://www.intuit.com/careers/hiring-process/"],
  "johnson-and-johnson": ["https://www.careers.jnj.com/en/how-we-hire/hiring-faqs"],
  mastercard: ["https://careers.mastercard.com/us/en/mastercards-hiring-process"],
  merck: ["https://jobs.merck.com/hiring-process"],
  micron: ["https://www.micron.com/about/careers/candidate"],
  mongodb: [
    "https://www.mongodb.com/company/blog/culture/recruiting-tips/how-prepare-your-engineering-interview-mongodb",
  ],
  netafim: ["https://careers.netafim.com/pages/our-hiring-process"],
  novartis: ["https://www.novartis.com/careers/career-hub"],
  nvidia: ["https://www.nvidia.com/en-us/about-nvidia/careers/how-we-hire/"],
  openweb: ["https://www.openweb.com/how-we-hire/"],
  "palo-alto-networks": ["https://jobs.paloaltonetworks.com/en/faq"],
  payoneer: ["https://careers.payoneer.com/candidate-faqs"],
  paypal: ["https://careers.pypl.com/how-we-recruit/interviewing/"],
  philips: ["https://www.careers.philips.com/na/en/how-we-hire"],
  "red-hat": ["https://www.redhat.com/en/jobs/info-guide"],
  salesforce: ["https://www.salesforce.com/company/careers/culture/how-we-hire/"],
  snowflake: ["https://careers.snowflake.com/us/en/gethired"],
  stryker: ["https://careers.stryker.com/hiring-at-stryker"],
  teva: ["https://www.tevapharm.com/your-career/how-we-hire/"],
  thales: ["https://careers.thalesgroup.com/global/en/candidate-how-to-apply"],
  unity: ["https://unity.com/blog/news/want-to-work-at-unity-heres-how-our-hiring-process-works"],
  wolt: ["https://careers.wolt.com/en/how-we-hire"],
};
