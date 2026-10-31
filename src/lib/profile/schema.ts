import { z } from "zod";
import { SENIORITIES, WORK_MODES } from "../taxonomy";

export const SKILL_LEVELS = ["BASIC", "GOOD", "EXPERT"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const SKILL_CATEGORIES = [
  "languages",
  "frontend",
  "backend",
  "data",
  "cloud",
  "mobile",
  "ml",
  "tools",
  "other",
] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const EDUCATION_KINDS = ["DEGREE", "BOOTCAMP", "CERTIFICATION", "COURSE", "MILITARY"] as const;
export type EducationKind = (typeof EDUCATION_KINDS)[number];

export const LANGUAGE_LEVELS = ["BASIC", "CONVERSATIONAL", "FLUENT", "NATIVE"] as const;

/** Israeli job-market regions. Keys are stable identifiers stored in Profile.regions. */
export const REGIONS = ["tel_aviv", "center", "sharon", "haifa", "north", "jerusalem", "south"] as const;
export type Region = (typeof REGIONS)[number];

export const COMPANY_TYPES = ["startup", "mid", "enterprise"] as const;
export const AVAILABILITIES = ["ACTIVE", "OPEN", "NOT_LOOKING"] as const;

const month = z
  .string()
  .trim()
  .regex(/^\d{4}(-\d{2})?$/, "YYYY or YYYY-MM");
const str = (max: number) => z.string().trim().max(max);
const tags = z.array(str(40).min(1)).max(40).default([]);

export const experienceItem = z.object({
  company: str(120).min(1),
  title: str(120).min(1),
  start: month.optional().or(z.literal("")),
  end: month.optional().or(z.literal("")), // empty = current
  description: str(2000).default(""),
  tech: tags,
});
export const skillItem = z.object({
  name: str(40).min(1),
  level: z.enum(SKILL_LEVELS).default("GOOD"),
  years: z.number().min(0).max(45).nullable().optional(),
  category: z.enum(SKILL_CATEGORIES).default("other"),
});
export const educationItem = z.object({
  kind: z.enum(EDUCATION_KINDS),
  institution: str(160).min(1),
  title: str(160).default(""),
  start: month.optional().or(z.literal("")),
  end: month.optional().or(z.literal("")),
});
export const languageItem = z.object({ name: str(40).min(1), level: z.enum(LANGUAGE_LEVELS).default("FLUENT") });
/** A personal / open-source / academic project (CV "Projects" section). */
export const projectItem = z.object({
  name: str(120).min(1),
  role: str(120).default(""),
  url: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Must start with https://")
    .default(""),
  start: month.optional().or(z.literal("")),
  end: month.optional().or(z.literal("")),
  description: str(1500).default(""),
  tech: tags,
});
/** Volunteering / community work. */
export const volunteerItem = z.object({
  organization: str(120).min(1),
  role: str(120).default(""),
  start: month.optional().or(z.literal("")),
  end: month.optional().or(z.literal("")),
  description: str(1000).default(""),
});
/** A free-form CV section the user names (e.g. "פרסומים", "Awards"); one line per bullet. */
export const customSection = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-z0-9]{1,24}$/)
    .default(() => Math.random().toString(36).slice(2, 10)),
  title: str(60).min(1),
  body: str(2000).default(""),
});
const phone = z
  .string()
  .trim()
  .max(30)
  .refine((v) => v === "" || /^[+\d][\d\s()-]{6,}$/.test(v), "phone")
  .default("");

const url = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Must start with https://")
  .default("");

export const professionalSchema = z.object({
  headline: str(140).default(""),
  summary: str(2000).default(""),
  experience: z.array(experienceItem).max(30).default([]),
  skillItems: z.array(skillItem).max(80).default([]),
  education: z.array(educationItem).max(20).default([]),
  languages: z.array(languageItem).max(10).default([]),
  linkedinUrl: url,
  githubUrl: url,
  portfolioUrl: url,
  // ── CV sections (additive, docs/cv-templates.md): the profile is the single source of CV content ──
  phone,
  projects: z.array(projectItem).max(20).default([]),
  volunteering: z.array(volunteerItem).max(15).default([]),
  customSections: z.array(customSection).max(6).default([]),
});
export type Professional = z.infer<typeof professionalSchema>;
export type ExperienceItem = z.infer<typeof experienceItem>;
export type SkillItem = z.infer<typeof skillItem>;
export type EducationItem = z.infer<typeof educationItem>;
export type LanguageItem = z.infer<typeof languageItem>;
export type ProjectItem = z.infer<typeof projectItem>;
export type VolunteerItem = z.infer<typeof volunteerItem>;
export type CustomSection = z.infer<typeof customSection>;

export const preferencesSchema = z
  .object({
    targetRoles: z.array(z.string()).max(6).default([]),
    targetSeniorities: z
      .array(z.enum(SENIORITIES as [string, ...string[]]))
      .max(6)
      .default([]),
    regions: z.array(z.enum(REGIONS)).default([]),
    workModes: z.array(z.enum(WORK_MODES as [string, ...string[]])).default([]),
    salaryMin: z.number().int().min(0).max(200_000).nullable().default(null),
    salaryMax: z.number().int().min(0).max(200_000).nullable().default(null),
    companyTypes: z.array(z.enum(COMPANY_TYPES)).default([]),
    wantedTech: tags,
    avoidTech: tags,
    availability: z.enum(AVAILABILITIES).nullable().default(null),
  })
  .refine((p) => p.salaryMin == null || p.salaryMax == null || p.salaryMin <= p.salaryMax, {
    message: "salary",
    path: ["salaryMax"],
  });
export type Preferences = z.infer<typeof preferencesSchema>;

/** Parse a JSON column defensively: drop invalid entries instead of failing the whole page. */
export function parseList<T>(schema: z.ZodType<T>, value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    const r = schema.safeParse(v);
    return r.success ? [r.data] : [];
  });
}

const CATEGORY_OF: Record<string, SkillCategory> = {};
/** Canonical spelling of every skill we can auto-categorize (used for add-skill autocomplete). */
export const KNOWN_SKILLS: string[] = [];
const put = (cat: SkillCategory, names: string[]) =>
  names.forEach((n) => {
    CATEGORY_OF[n.toLowerCase()] = cat;
    KNOWN_SKILLS.push(n);
  });
put("languages", [
  "TypeScript",
  "JavaScript",
  "Python",
  "Java",
  "Kotlin",
  "Swift",
  "Go",
  "Rust",
  "C++",
  "C#",
  "C",
  "Ruby",
  "PHP",
  "Scala",
  "Bash",
  "Elixir",
]);
put("frontend", ["React", "Next.js", "Angular", "Vue", "HTML", "CSS", "Tailwind", "Redux", "Svelte", "Figma"]);
put("backend", [
  "Node.js",
  "Django",
  "FastAPI",
  "Spring",
  ".NET",
  "GraphQL",
  "REST",
  "gRPC",
  "Kafka",
  "RabbitMQ",
  "Express",
  "NestJS",
  "Microservices",
]);
put("data", [
  "SQL",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "Elasticsearch",
  "Spark",
  "Airflow",
  "Snowflake",
  "BigQuery",
  "dbt",
  "Databricks",
  "Tableau",
  "Pandas",
]);
put("cloud", [
  "AWS",
  "GCP",
  "Azure",
  "Docker",
  "Kubernetes",
  "Terraform",
  "Linux",
  "CI/CD",
  "Jenkins",
  "Helm",
  "Ansible",
  "Serverless",
]);
put("mobile", ["iOS", "Android", "React Native", "Flutter"]);
put("ml", [
  "Machine Learning",
  "PyTorch",
  "TensorFlow",
  "LLM",
  "NLP",
  "Computer Vision",
  "Deep Learning",
  "scikit-learn",
]);
put("tools", ["Git", "Jira", "Selenium", "Cypress", "Playwright", "Jest"]);

export function categorizeSkill(name: string): SkillCategory {
  return CATEGORY_OF[name.trim().toLowerCase()] ?? "other";
}

const REGION_CITIES: Record<Region, string[]> = {
  tel_aviv: [
    "tel aviv",
    "tel-aviv",
    "תל אביב",
    "ramat gan",
    "רמת גן",
    "givatayim",
    "bnei brak",
    "bne brak",
    "holon",
    "bat yam",
    "jaffa",
  ],
  center: [
    "petah tikva",
    "petach tikva",
    "פתח תקווה",
    "rishon",
    "rehovot",
    "רחובות",
    "ness ziona",
    "lod",
    "airport city",
    "modiin",
    "modi'in",
    "yehud",
    "or yehuda",
    "rosh haayin",
    "rosh ha'ayin",
    "shoham",
    "ramla",
  ],
  sharon: [
    "herzliya",
    "הרצליה",
    "ra'anana",
    "raanana",
    "רעננה",
    "kfar saba",
    "כפר סבא",
    "hod hasharon",
    "netanya",
    "נתניה",
    "kfar yona",
    "even yehuda",
  ],
  haifa: [
    "haifa",
    "חיפה",
    "matam",
    "caesarea",
    "קיסריה",
    "yokneam",
    "יקנעם",
    "kiryat",
    "nesher",
    "tirat carmel",
    "hadera",
  ],
  north: [
    "nazareth",
    "karmiel",
    "tiberias",
    "afula",
    "migdal haemek",
    "kiryat shmona",
    "tefen",
    "nahariya",
    "galilee",
    "akko",
    "acre",
  ],
  jerusalem: ["jerusalem", "ירושלים", "beit shemesh", "mevaseret"],
  south: [
    "be'er sheva",
    "beer sheva",
    "beersheba",
    "באר שבע",
    "ashdod",
    "ashkelon",
    "kiryat gat",
    "eilat",
    "dimona",
    "omer",
  ],
};

/** Map a free-text job location to an Israeli region; undefined when unknown (e.g. "Israel"). */
export function regionOf(location: string): Region | undefined {
  const l = location.toLowerCase();
  for (const r of REGIONS) if (REGION_CITIES[r].some((c) => l.includes(c))) return r;
  return undefined;
}

/** Duration in years between YYYY[-MM] strings; open end = now. */
export function spanYears(start?: string, end?: string, now = new Date()): number {
  if (!start) return 0;
  const toMonths = (s: string) => {
    const [y, m] = s.split("-").map(Number);
    return y * 12 + ((m || 1) - 1);
  };
  const e = end ? toMonths(end) : now.getFullYear() * 12 + now.getMonth();
  return Math.max(0, (e - toMonths(start) + 1) / 12);
}
