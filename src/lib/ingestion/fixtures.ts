/**
 * Fictional demo data in each ATS's raw format. Company names are invented.
 * Used by the seed script and adapter tests, so seeding exercises the real normalize path.
 */
import type { ComeetPosition } from "./adapters/comeet";
import type { GreenhouseJob } from "./adapters/greenhouse";
import type { LeverPosting } from "./adapters/lever";

export interface DemoCompany {
  slug: string;
  name: string;
  industry: string;
  size: string;
  hqLocation: string;
  description: string;
  provider: "GREENHOUSE" | "LEVER" | "COMEET";
}

export const DEMO_COMPANIES: DemoCompany[] = [
  {
    slug: "cloudnest",
    name: "CloudNest",
    industry: "Cloud infrastructure",
    size: "200-500",
    hqLocation: "Tel Aviv",
    provider: "GREENHOUSE",
    description: "Developer platform for running serverless workloads at the edge.",
  },
  {
    slug: "medisight",
    name: "MediSight",
    industry: "HealthTech",
    size: "50-200",
    hqLocation: "Haifa",
    provider: "LEVER",
    description: "Computer vision for faster radiology diagnosis.",
  },
  {
    slug: "payloop",
    name: "PayLoop",
    industry: "FinTech",
    size: "500-1000",
    hqLocation: "Ramat Gan",
    provider: "COMEET",
    description: "Real-time cross-border payments for marketplaces.",
  },
  {
    slug: "shieldgrid",
    name: "ShieldGrid",
    industry: "Cybersecurity",
    size: "200-500",
    hqLocation: "Herzliya",
    provider: "GREENHOUSE",
    description: "Cloud security posture management for enterprises.",
  },
  {
    slug: "agrimind",
    name: "AgriMind",
    industry: "AgriTech",
    size: "10-50",
    hqLocation: "Rehovot",
    provider: "LEVER",
    description: "AI-driven irrigation and crop analytics.",
  },
  {
    slug: "routely",
    name: "Routely",
    industry: "Mobility",
    size: "50-200",
    hqLocation: "Jerusalem",
    provider: "COMEET",
    description: "Last-mile delivery optimization.",
  },
  {
    slug: "datacove",
    name: "DataCove",
    industry: "Data infrastructure",
    size: "200-500",
    hqLocation: "Tel Aviv",
    provider: "GREENHOUSE",
    description: "Streaming data warehouse for product analytics.",
  },
  {
    slug: "chipwave",
    name: "ChipWave",
    industry: "Semiconductors",
    size: "1000+",
    hqLocation: "Yokneam",
    provider: "COMEET",
    description: "Networking silicon for AI datacenters.",
  },
];

const TITLES: [string, string][] = [
  ["Senior Backend Engineer", "Node.js, TypeScript, PostgreSQL, Kafka, AWS, Docker"],
  ["Full Stack Developer", "React, Next.js, Node.js, TypeScript, MongoDB"],
  ["Junior Frontend Developer", "React, TypeScript, JavaScript, Figma"],
  ["DevOps Engineer", "Kubernetes, Terraform, AWS, Docker, Linux, Python"],
  ["Data Engineer", "Python, Spark, Airflow, SQL, GCP"],
  ["Machine Learning Engineer", "Python, PyTorch, LLM, Kubernetes, AWS"],
  ["QA Automation Engineer", "Playwright, Cypress, TypeScript, Selenium"],
  ["Team Lead, Backend", "Java, Spring, Kafka, Redis, Kubernetes"],
  ["Android Developer", "Kotlin, Java, GraphQL"],
  ["Product Manager", "SQL, Figma"],
  ["Security Researcher", "Python, Linux, C++, AWS"],
  ["Software Engineering Student", "Python, Java, SQL"],
  ["Senior Go Engineer", "Golang, Kubernetes, gRPC, PostgreSQL, GCP"],
];

const MODES = ["Hybrid", "On-site", "Remote"];

function description(company: DemoCompany, title: string, stack: string, mode: string) {
  return `<p>${company.name} is hiring a ${title} to join our ${company.hqLocation} team (${mode}).</p>
<p><strong>What you'll do</strong></p><ul><li>Design, build and own production services used by thousands of customers</li><li>Collaborate with product and design on new features</li></ul>
<p><strong>Requirements</strong></p><ul><li>Hands-on experience with ${stack}</li><li>Strong communication skills in Hebrew and English</li></ul>`;
}

/** Deterministic pseudo-random so seeds are stable across runs. */
function pick<T>(arr: T[], n: number) {
  return arr[n % arr.length]!;
}

export function demoRawJobs(company: DemoCompany, index: number, now = Date.now()) {
  const count = 4 + (index % 4);
  const out: { greenhouse?: GreenhouseJob; lever?: LeverPosting; comeet?: ComeetPosition }[] = [];
  for (let i = 0; i < count; i++) {
    const [title, stack] = pick(TITLES, index * 3 + i * 5);
    const mode = pick(MODES, index + i);
    const posted = new Date(now - ((index * 7 + i * 3) % 30) * 86400000);
    const id = `${company.slug}-${i}`;
    const html = description(company, title, stack, mode);
    const url = `https://example.com/careers/${company.slug}/${i}`;
    if (company.provider === "GREENHOUSE") {
      out.push({
        greenhouse: {
          id: 100000 + index * 100 + i,
          title,
          absolute_url: url,
          first_published: posted.toISOString(),
          location: {
            name: `${company.hqLocation}, Israel${mode === "Remote" ? " (Remote)" : mode === "Hybrid" ? " (Hybrid)" : ""}`,
          },
          content: html.replace(/</g, "&lt;").replace(/>/g, "&gt;"),
        },
      });
    } else if (company.provider === "LEVER") {
      out.push({
        lever: {
          id,
          text: title,
          hostedUrl: url,
          createdAt: posted.getTime(),
          workplaceType: mode === "Remote" ? "remote" : mode === "Hybrid" ? "hybrid" : "onsite",
          categories: { location: company.hqLocation, team: "R&D" },
          descriptionPlain: html.replace(/<[^>]+>/g, " "),
        },
      });
    } else {
      out.push({
        comeet: {
          uid: id.toUpperCase(),
          name: title,
          url_active_page: url,
          time_updated: posted.toISOString(),
          workplace_type: mode,
          location: { city: company.hqLocation, country: "IL", is_remote: mode === "Remote" },
          details: [{ name: "Description", value: html }],
        },
      });
    }
  }
  return out;
}
