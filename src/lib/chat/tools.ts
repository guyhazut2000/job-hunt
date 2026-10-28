import { tool } from "ai";
import { z } from "zod";
import { JOB_DOMAINS } from "@/lib/jobs/domains";
import { MODES } from "@/lib/commute/keys";
import { CHAT_MAX_JOBS, companyInfo, explainMatch, searchJobs, type ChatContext } from "./data";
import { toModelPayload } from "./model-view";
import type { CompanyInfoOutput, ExplainMatchOutput, SearchJobsOutput } from "./types";

/**
 * AI SDK tools for the assistant. Read-only: no tool applies, saves, sends or edits anything.
 * The UI gets the full output (rendered as cards); the model gets a compact copy wrapped as
 * untrusted data (`toModelOutput`), so text from the DB can't pose as instructions.
 */

const LEVELS = ["INTERN", "ENTRY", "MID", "SENIOR", "LEAD", "MANAGER", "DIRECTOR", "EXECUTIVE"] as const;
const WORK = ["ONSITE", "HYBRID", "REMOTE"] as const;

export const searchJobsSchema = z.object({
  query: z
    .string()
    .max(100)
    .optional()
    .describe(
      "Free-text keywords: job title words, technologies or skills (e.g. 'Python', 'Node.js'). Omit words already covered by domain/city/level.",
    ),
  domain: z
    .array(z.enum(JOB_DOMAINS))
    .max(3)
    .optional()
    .describe("Professional field, e.g. backend, frontend, fullstack, devops, data-science, qa, security, product."),
  city: z
    .string()
    .max(60)
    .optional()
    .describe("City where the job is, in Hebrew or English (e.g. 'חיפה', 'Tel Aviv')."),
  level: z.array(z.enum(LEVELS)).max(4).optional().describe("Seniority level. ENTRY = junior/student."),
  workMode: z.array(z.enum(WORK)).max(3).optional(),
  company: z.string().max(80).optional().describe("Company name, only when the user names a company."),
  maxCommuteMinutes: z.number().int().min(5).max(180).optional().describe("Max one-way commute in minutes."),
  commuteMode: z.enum(MODES).optional().describe("transit = train/bus/public transport; car = driving."),
  commuteFrom: z
    .string()
    .max(60)
    .optional()
    .describe("Where the user commutes from (a city). Omit to use the user's saved default place."),
  limit: z.number().int().min(1).max(CHAT_MAX_JOBS).optional(),
});

export const explainMatchSchema = z
  .object({
    jobId: z.string().max(40).optional().describe("Job id from an earlier search_jobs result (preferred)."),
    jobQuery: z.string().max(100).optional().describe("Job title and/or company when no id is known."),
  })
  .describe("Omit both fields to explain the user's best-matching open job.");
export const companyInfoSchema = z.object({
  company: z.string().min(1).max(80).describe("Company name or slug."),
  from: z.string().max(60).optional().describe("City to compute the commute from; omit for the saved default place."),
});

export function chatTools(ctx: ChatContext) {
  return {
    search_jobs: tool<z.infer<typeof searchJobsSchema>, SearchJobsOutput>({
      description:
        "Search open jobs in the app's database with filters, optional commute limit, ranked by relevance and the user's match. Returns job cards that the UI shows.",
      inputSchema: searchJobsSchema,
      execute: (input) => searchJobs(input, ctx),
      toModelOutput: ({ output }) => toModelPayload(output),
    }),
    explain_match: tool<z.infer<typeof explainMatchSchema>, ExplainMatchOutput>({
      description:
        "Explain how well one job fits the signed-in user's profile: match score, reasons, matched and missing skills, and a learning plan for the gaps.",
      inputSchema: explainMatchSchema,
      execute: (input) => explainMatch(input, ctx),
      toModelOutput: ({ output }) => toModelPayload(output),
    }),
    company_info: tool<z.infer<typeof companyInfoSchema>, CompanyInfoOutput>({
      description:
        "Facts about one company from the app: open jobs, domains, locations, commute from the user's place, the published hiring process with sources, and community review links.",
      inputSchema: companyInfoSchema,
      execute: (input) => companyInfo(input, ctx),
      toModelOutput: ({ output }) => toModelPayload(output),
    }),
  };
}

export type ChatTools = ReturnType<typeof chatTools>;
export const CHAT_TOOL_NAMES = ["search_jobs", "explain_match", "company_info"] as const;
export type ChatToolName = (typeof CHAT_TOOL_NAMES)[number];
