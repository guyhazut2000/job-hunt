import type { Prisma, Seniority, WorkMode } from "@prisma/client";
import { ROLE_CATEGORIES, SENIORITIES, WORK_MODES } from "../taxonomy";

export interface JobFilters {
  q?: string;
  role?: string;
  seniority?: Seniority;
  location?: string;
  workMode?: WorkMode;
  tech?: string;
  company?: string;
  page: number;
}

export const PAGE_SIZE = 20;

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/** Parse untrusted URL search params into validated filters. */
export function parseFilters(params: Params): JobFilters {
  const role = one(params.role);
  const seniority = one(params.seniority) as Seniority | undefined;
  const workMode = one(params.workMode) as WorkMode | undefined;
  const page = Math.max(1, Math.min(500, Number.parseInt(one(params.page) ?? "1", 10) || 1));
  return {
    q: one(params.q)?.slice(0, 100),
    role: role && (ROLE_CATEGORIES as readonly string[]).includes(role) ? role : undefined,
    seniority: seniority && SENIORITIES.includes(seniority) ? seniority : undefined,
    location: one(params.location)?.slice(0, 60),
    workMode: workMode && WORK_MODES.includes(workMode) ? workMode : undefined,
    tech: one(params.tech)?.slice(0, 40),
    company: one(params.company)?.slice(0, 80),
    page,
  };
}

export function filtersToWhere(f: JobFilters): Prisma.JobWhereInput {
  const where: Prisma.JobWhereInput = { isActive: true };
  if (f.role) where.roleCategory = f.role;
  if (f.seniority) where.seniority = f.seniority;
  if (f.workMode) where.workMode = f.workMode;
  if (f.location) where.location = { contains: f.location, mode: "insensitive" };
  if (f.tech) where.techStack = { has: f.tech };
  if (f.company) where.company = { slug: f.company };
  if (f.q) {
    where.OR = [
      { title: { contains: f.q, mode: "insensitive" } },
      { description: { contains: f.q, mode: "insensitive" } },
      { company: { name: { contains: f.q, mode: "insensitive" } } },
    ];
  }
  return where;
}

export function filtersToQuery(f: Partial<JobFilters>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v !== undefined && v !== "" && !(k === "page" && v === 1)) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
