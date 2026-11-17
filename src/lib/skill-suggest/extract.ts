/**
 * Required / preferred skills for a batch of jobs: one structured AI call for the whole batch
 * (feature `skill_suggest`, cached by prompt in the AI cache and inside the free-tier limits),
 * with the rules extractor as the fallback for AI off, over the limit, or a bad response.
 */
import { z } from "zod";
import { AiLimitError, type LLMProvider } from "@/lib/ai";
import { heuristicJobSkills, type JobSkills } from "./core";

export interface JobInput {
  id: string;
  title: string;
  company: string;
  score: number;
  techStack: string[];
  description: string;
}

/** Characters of each description sent to the model (keeps the batch well under the context). */
export const DESC_CHARS = 1500;

const skill = z.string().min(1).max(60);
export const extractionSchema = z.object({
  jobs: z
    .array(
      z.object({
        ref: z.string(),
        required: z.array(skill).max(25),
        preferred: z.array(skill).max(20),
      }),
    )
    .max(40),
});

const SYSTEM =
  'You read job postings and list the concrete, CV-listable skills each one asks for: languages, frameworks, databases, cloud, tools, methods (e.g. "Microservices", "CI/CD", "System Design"). ' +
  'Split them into "required" (must-have / requirements) and "preferred" (nice to have, advantage, plus, יתרון). ' +
  "Use the common English name of each skill (Kubernetes, not k8s). Skip soft skills, spoken languages, degrees and years of experience. " +
  "Only list skills the posting actually mentions; never guess. Postings may be in Hebrew. " +
  'Respond as JSON: {"jobs":[{"ref":string,"required":string[],"preferred":string[]}]} with one entry per posting, using its ref.';

export function buildPrompt(jobs: JobInput[]): string {
  return jobs
    .map(
      (j, i) =>
        `### ref: j${i + 1}\nTitle: ${j.title}\nListed stack: ${j.techStack.join(", ") || "—"}\n${j.description.replace(/\s+/g, " ").slice(0, DESC_CHARS)}`,
    )
    .join("\n\n");
}

export type Extraction = { source: "ai" | "rules"; limited: string | null; jobs: JobSkills[] };

const rules = (jobs: JobInput[]): JobSkills[] =>
  jobs.map((j) => ({ id: j.id, title: j.title, company: j.company, score: j.score, ...heuristicJobSkills(j) }));

/** Merge the AI lists with the job's own tech stack, which the jobs page already trusts. */
export function mergeAi(jobs: JobInput[], parsed: z.infer<typeof extractionSchema>): JobSkills[] | null {
  const byRef = new Map(parsed.jobs.map((x) => [x.ref.trim().toLowerCase(), x]));
  let hits = 0;
  const out = jobs.map((j, i) => {
    const ai = byRef.get(`j${i + 1}`);
    if (!ai) return { id: j.id, title: j.title, company: j.company, score: j.score, ...heuristicJobSkills(j) };
    hits++;
    const required = [...new Set([...j.techStack, ...ai.required])];
    const preferred = ai.preferred.filter((p) => !required.some((r) => r.toLowerCase() === p.toLowerCase()));
    return { id: j.id, title: j.title, company: j.company, score: j.score, required, preferred };
  });
  return hits ? out : null;
}

export async function extractJobSkills(
  jobs: JobInput[],
  provider: LLMProvider & { limited?: string | null },
): Promise<Extraction> {
  if (!jobs.length) return { source: "rules", limited: null, jobs: [] };
  if (provider.name === "mock") return { source: "rules", limited: null, jobs: rules(jobs) };
  try {
    const raw = await provider.complete(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildPrompt(jobs) },
      ],
      { json: true, schema: extractionSchema, maxTokens: 6000 },
    );
    const parsed = extractionSchema.safeParse(JSON.parse(raw));
    const merged = parsed.success ? mergeAi(jobs, parsed.data) : null;
    if (!merged) throw new Error("bad shape");
    return { source: "ai", limited: null, jobs: merged };
  } catch (e) {
    const limited = e instanceof AiLimitError ? e.reason : (provider.limited ?? null);
    return { source: "rules", limited, jobs: rules(jobs) };
  }
}
