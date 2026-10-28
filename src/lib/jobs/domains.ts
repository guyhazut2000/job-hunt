/**
 * Job domains (תחום): the professional field a posting belongs to, shown as a badge on job cards
 * and used as a filter. Pure data (no classifier code) so client components can import it cheaply.
 * The classifier lives in `./domain-classifier`.
 */
export const JOB_DOMAINS = [
  "backend",
  "frontend",
  "fullstack",
  "mobile",
  "software",
  "devops",
  "cloud",
  "data-eng",
  "data-science",
  "analytics",
  "qa",
  "security",
  "embedded",
  "hardware",
  "it",
  "product",
  "design",
  "project",
  "support",
  "sales",
  "business-ops",
  "other",
] as const;
export type JobDomain = (typeof JOB_DOMAINS)[number];

export const isJobDomain = (v: unknown): v is JobDomain =>
  typeof v === "string" && (JOB_DOMAINS as readonly string[]).includes(v);

export const DOMAIN_LABELS: Record<"en" | "he", Record<JobDomain, string>> = {
  en: {
    backend: "Backend",
    frontend: "Frontend",
    fullstack: "Full Stack",
    mobile: "Mobile",
    software: "Software (general)",
    devops: "DevOps / SRE / Platform",
    cloud: "Cloud & Infrastructure",
    "data-eng": "Data Engineering",
    "data-science": "Data Science / ML / AI",
    analytics: "Data Analysis & BI",
    qa: "QA & Automation",
    security: "Security & Cyber",
    embedded: "Embedded & Firmware",
    hardware: "Hardware, Chips & Systems",
    it: "IT & System Admin",
    product: "Product",
    design: "Design & UX",
    project: "Project & Program Mgmt",
    support: "Support & Solutions",
    sales: "Sales & Marketing",
    "business-ops": "Ops, Finance & HR",
    other: "Other",
  },
  he: {
    backend: "Backend",
    frontend: "Frontend",
    fullstack: "Full Stack",
    mobile: "מובייל",
    software: "פיתוח תוכנה (כללי)",
    devops: "DevOps / SRE / פלטפורמה",
    cloud: "ענן ותשתיות",
    "data-eng": "הנדסת נתונים",
    "data-science": "Data Science / ML / AI",
    analytics: "ניתוח נתונים ו-BI",
    qa: "QA ואוטומציה",
    security: "סייבר ואבטחת מידע",
    embedded: "Embedded וקושחה",
    hardware: "חומרה, שבבים ומערכות",
    it: "IT וניהול מערכות",
    product: "מוצר",
    design: "עיצוב ו-UX",
    project: "ניהול פרויקטים ותוכניות",
    support: "תמיכה ופתרונות",
    sales: "מכירות ושיווק",
    "business-ops": "תפעול, כספים ומשא״ן",
    other: "אחר",
  },
};

/**
 * Badge colours per domain (full literal class names so Tailwind picks them up).
 * Related domains share a hue family: software = blue/indigo, infra = cyan/teal, data = violet,
 * hardware = amber, business = rose/pink, neutral = slate.
 */
export const DOMAIN_COLORS: Record<JobDomain, string> = {
  backend: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200",
  frontend: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200",
  fullstack:
    "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-200",
  mobile: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-200",
  software: "border-blue-200 bg-blue-50/60 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200",
  devops: "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-200",
  cloud:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  "data-eng":
    "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200",
  "data-science":
    "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-200",
  analytics:
    "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800 dark:border-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-200",
  qa: "border-lime-200 bg-lime-50 text-lime-800 dark:border-lime-900 dark:bg-lime-950 dark:text-lime-200",
  security: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
  embedded:
    "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200",
  hardware: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  it: "border-stone-200 bg-stone-50 text-stone-800 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200",
  product: "border-pink-200 bg-pink-50 text-pink-800 dark:border-pink-900 dark:bg-pink-950 dark:text-pink-200",
  design: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200",
  project:
    "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200",
  support: "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200",
  sales: "border-pink-200 bg-pink-50/60 text-pink-900 dark:border-pink-900 dark:bg-pink-950 dark:text-pink-200",
  "business-ops":
    "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200",
  other: "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
};

/** Badge tooltip / accessible name pieces. */
export const DOMAIN_STRINGS = {
  en: { field: "Field", auto: "classified automatically", filter: "show all jobs in this field" },
  he: { field: "תחום", auto: "סווג אוטומטית", filter: "הצגת כל המשרות בתחום" },
} as const;

/** URL that applies the domain filter on the jobs board. */
export const domainHref = (d: JobDomain) => `/jobs?domain=${encodeURIComponent(d)}`;
