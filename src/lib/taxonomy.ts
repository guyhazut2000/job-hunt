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
  "hardware",
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
  "Hod Hasharon",
  "Kfar Saba",
  "Rishon LeZion",
  "Caesarea",
  "Israel",
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
  "vue.js": "Vue",
  "react.js": "React",
  nestjs: "NestJS",
  snowflake: "Snowflake",
  bigquery: "BigQuery",
  databricks: "Databricks",
  dbt: "dbt",
  clickhouse: "ClickHouse",
  cassandra: "Cassandra",
  dynamodb: "DynamoDB",
  rabbitmq: "RabbitMQ",
  grpc: "gRPC",
  helm: "Helm",
  ansible: "Ansible",
  jenkins: "Jenkins",
  "github actions": "GitHub Actions",
  prometheus: "Prometheus",
  grafana: "Grafana",
  langchain: "LangChain",
  pandas: "Pandas",
  "scikit-learn": "scikit-learn",
  opencv: "OpenCV",
  cuda: "CUDA",
  verilog: "Verilog",
  systemverilog: "SystemVerilog",
  vhdl: "VHDL",
  rtos: "RTOS",
  matlab: "MATLAB",
  redux: "Redux",
  tailwind: "Tailwind",
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

/** Titles where "manager" is a function, not people management (e.g. Product Manager). */
const IC_MANAGER =
  /\b(product|program|project|account|partner|channel|customer success|marketing|community|content|campaign|category|release|delivery) manager\b/;

export function inferSeniority(title: string): Seniority {
  const t = title.toLowerCase().replace(/office of the (cto|ceo)|(cto|ceo) office/g, "");
  if (/\b(intern|internship|student)\b|סטודנט/.test(t)) return "INTERN";
  const peopleManager =
    /\b(head of|director|vp|vice president|cto|chief)\b|מנהל/.test(t) ||
    (/\bmanager\b/.test(t) && !IC_MANAGER.test(t.replace(/\b(senior|sr\.?|group|principal|lead)\s+/g, "")));
  if (peopleManager) return "MANAGER";
  if (/\b(lead|leader|principal|staff|architect|group product manager)\b|ראש צוות|ר"צ/.test(t)) return "LEAD";
  if (/\b(senior|sr\.?)\b|בכיר/.test(t)) return "SENIOR";
  if (/\b(junior|jr\.?|entry[\s-]level|graduate|new grad)\b|ג'וניור|מתחיל/.test(t)) return "JUNIOR";
  return "MID";
}

/** Non-engineering functions that would otherwise be caught by the "engineer" fallback. */
const NON_TECH =
  /\b(sales|account executive|account manager|business development|bdr|sdr|marketing|recruit\w*|talent|hr|human resources|people (partner|operations)|finance|financial|accountant|accounting|controller|payroll|legal|counsel|paralegal|office manager|customer success|customer support|support (engineer|specialist)|solutions? (engineer|architect|consultant)|pre-?sales|partnerships?|procurement|operations specialist)\b/;

export function inferRoleCategory(title: string): RoleCategory {
  const t = title.toLowerCase();
  if (/designer|\bux\b|ui\/ux|product design/.test(t)) return "design";
  if (/product manag|product owner|\bpm\b|(head|director|vp) of product|vp,? product|product lead/.test(t))
    return "product";
  if (NON_TECH.test(t)) return "other";
  if (/full[\s-]?stack/.test(t)) return "fullstack";
  if (/front[\s-]?end|ui engineer|web developer/.test(t)) return "frontend";
  if (/back[\s-]?end|server|platform engineer|\bapi\b/.test(t)) return "backend";
  if (/android|\bios\b|mobile/.test(t)) return "mobile";
  if (
    /embedded|firmware|hardware|\basic\b|fpga|vlsi|\bchip\b|silicon|physical design|design verification|\brtl\b|analog|electrical engineer|board design/.test(
      t,
    )
  )
    return "hardware";
  if (/devops|\bsre\b|site reliability|infrastructure|cloud engineer|\bit\b/.test(t)) return "devops";
  if (/machine learning|\bml\b|\bai\b|deep learning|computer vision|\bnlp\b|\bllm\b|algorithm/.test(t)) return "ml";
  if (/\bdata\b|analytics|\bbi\b|analyst/.test(t)) return "data";
  if (/\bqa\b|quality|automation engineer|\btest|validation/.test(t)) return "qa";
  if (/security|cyber|appsec|penetration|pentest|red team|threat|malware|incident respon|\bsoc\b|\bgrc\b/.test(t))
    return "security";
  if (/manager|director|head of|\bvp\b/.test(t)) return "management";
  if (/engineer|developer|software|programmer|r&d/.test(t)) return "backend";
  return "other";
}

export function inferWorkMode(text: string): WorkMode {
  const t = text.toLowerCase();
  if (/hybrid|היברידי/.test(t)) return "HYBRID";
  if (/remote|מרחוק|מהבית|work from home|wfh|home[\s-]based/.test(t)) return "REMOTE";
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
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
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
