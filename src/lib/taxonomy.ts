import type { Seniority, WorkMode } from "@prisma/client";

/** Canonical role categories used for filtering. Keys are stable identifiers. */
export const ROLE_CATEGORIES = [
  "backend",
  "frontend",
  "fullstack",
  "mobile",
  "devops",
  "data",
  "ml",
  "qa",
  "security",
  "product",
  "design",
  "management",
  "other",
] as const;
export type RoleCategory = (typeof ROLE_CATEGORIES)[number];

export const SENIORITIES: Seniority[] = ["INTERN", "JUNIOR", "MID", "SENIOR", "LEAD", "MANAGER"];
export const WORK_MODES: WorkMode[] = ["ONSITE", "HYBRID", "REMOTE"];

export const LOCATIONS = [
  "Tel Aviv",
  "Herzliya",
  "Ramat Gan",
  "Petah Tikva",
  "Haifa",
  "Jerusalem",
  "Be'er Sheva",
  "Ra'anana",
  "Netanya",
  "Yokneam",
  "Rehovot",
] as const;

/** Tech keywords we detect in job descriptions and CVs. Lowercase match key -> display label. */
export const TECH_KEYWORDS: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  react: "React",
  "next.js": "Next.js",
  nextjs: "Next.js",
  angular: "Angular",
  vue: "Vue",
  "node.js": "Node.js",
  nodejs: "Node.js",
  python: "Python",
  django: "Django",
  fastapi: "FastAPI",
  java: "Java",
  spring: "Spring",
  kotlin: "Kotlin",
  swift: "Swift",
  go: "Go",
  golang: "Go",
  rust: "Rust",
  "c++": "C++",
  "c#": "C#",
  ".net": ".NET",
  ruby: "Ruby",
  php: "PHP",
  scala: "Scala",
  sql: "SQL",
  postgresql: "PostgreSQL",
  postgres: "PostgreSQL",
  mysql: "MySQL",
  mongodb: "MongoDB",
  redis: "Redis",
  kafka: "Kafka",
  elasticsearch: "Elasticsearch",
  graphql: "GraphQL",
  aws: "AWS",
  gcp: "GCP",
  azure: "Azure",
  docker: "Docker",
  kubernetes: "Kubernetes",
  k8s: "Kubernetes",
  terraform: "Terraform",
  linux: "Linux",
  spark: "Spark",
  airflow: "Airflow",
  pytorch: "PyTorch",
  tensorflow: "TensorFlow",
  llm: "LLM",
  figma: "Figma",
  selenium: "Selenium",
  playwright: "Playwright",
  cypress: "Cypress",
  "react native": "React Native",
  flutter: "Flutter",
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Extract canonical tech labels from free text. Deterministic and dependency-free. */
export function extractTech(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const found = new Set<string>();
  for (const [key, label] of Object.entries(TECH_KEYWORDS)) {
    // Word-ish boundary that tolerates symbols like "c++", ".net", "node.js".
    const re = new RegExp(`(^|[^a-z0-9+#.])${escapeRegex(key)}(?=$|[^a-z0-9+#])`, "i");
    if (re.test(lower)) found.add(label);
  }
  // "go" is too ambiguous in prose; only keep it if "golang" or "go developer/engineer" appear.
  if (found.has("Go") && !/golang|\bgo (developer|engineer)|\bin go\b|\bgo,/i.test(text)) {
    found.delete("Go");
  }
  return [...found].sort();
}

export function inferSeniority(title: string): Seniority {
  const t = title.toLowerCase();
  if (/\b(intern|student)\b|סטודנט/.test(t)) return "INTERN";
  if (/\b(head of|director|vp|manager)\b|מנהל/.test(t)) return "MANAGER";
  if (/\b(lead|principal|staff|architect)\b|ראש צוות/.test(t)) return "LEAD";
  if (/\b(senior|sr\.?)\b|בכיר/.test(t)) return "SENIOR";
  if (/\b(junior|jr\.?|entry|graduate)\b|ג'וניור|מתחיל/.test(t)) return "JUNIOR";
  return "MID";
}

export function inferRoleCategory(title: string): RoleCategory {
  const t = title.toLowerCase();
  if (/full[\s-]?stack/.test(t)) return "fullstack";
  if (/front[\s-]?end|ui engineer|web developer/.test(t)) return "frontend";
  if (/back[\s-]?end|server|platform engineer|api/.test(t)) return "backend";
  if (/android|ios|mobile/.test(t)) return "mobile";
  if (/devops|sre|site reliability|infrastructure|cloud engineer/.test(t)) return "devops";
  if (/machine learning|\bml\b|\bai\b|deep learning|computer vision|nlp|llm/.test(t)) return "ml";
  if (/data (engineer|scientist|analyst)|analytics|\bbi\b/.test(t)) return "data";
  if (/\bqa\b|quality|automation engineer|test/.test(t)) return "qa";
  if (/security|cyber|appsec|penetration/.test(t)) return "security";
  if (/product manager|product owner|\bpm\b/.test(t)) return "product";
  if (/designer|ux|ui\/ux/.test(t)) return "design";
  if (/manager|director|head of|vp/.test(t)) return "management";
  if (/engineer|developer|software/.test(t)) return "backend";
  return "other";
}

export function inferWorkMode(text: string): WorkMode {
  const t = text.toLowerCase();
  if (/hybrid|היברידי/.test(t)) return "HYBRID";
  if (/remote|מרחוק|work from home|wfh/.test(t)) return "REMOTE";
  return "ONSITE";
}

/** Strip HTML tags/entities to plain text (good enough for ATS descriptions). */
export function htmlToText(html: string): string {
  // Greenhouse returns HTML-escaped HTML, sometimes double-escaped (&amp;amp;).
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}
