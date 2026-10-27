import { getLLMProvider } from ".";
import { extractTech } from "../taxonomy";
import type { CvSuggestion, LLMProvider } from "./types";

export interface CvSuggestionInput {
  resumeText: string;
  job: { title: string; description: string; techStack: string[] };
  locale: "he" | "en";
}

/** Heuristic suggestions: used by the mock provider and as a fallback if the LLM fails. */
export function heuristicSuggestions({ resumeText, job, locale }: CvSuggestionInput): CvSuggestion[] {
  const he = locale === "he";
  const cvTech = new Set(extractTech(resumeText).map((s) => s.toLowerCase()));
  const out: CvSuggestion[] = [];
  for (const skill of job.techStack.filter((s) => !cvTech.has(s.toLowerCase())).slice(0, 5)) {
    out.push({
      kind: "missing_skill",
      text: he
        ? `המשרה מזכירה ${skill}. אם יש לך ניסיון עם ${skill}, הוסף אותו במפורש עם דוגמה מפרויקט.`
        : `The job mentions ${skill}. If you have experience with it, list it explicitly with a project example.`,
    });
  }
  if (!/\d+%|\d+x|\d+ (users|customers|ms)|\d+k/i.test(resumeText)) {
    out.push({
      kind: "impact",
      text: he
        ? 'הוסף תוצאות מדידות (למשל: "קיצרתי זמן טעינה ב-40%") — מגייסים ומערכות ATS מחפשים מספרים.'
        : 'Add measurable outcomes (e.g. "cut page load time by 40%"). Recruiters and ATS filters look for numbers.',
    });
  }
  if (!resumeText.toLowerCase().includes(job.title.toLowerCase().split(" ").slice(-1)[0] ?? "")) {
    out.push({
      kind: "summary",
      text: he
        ? `התאם את שורת הפתיחה בקו"ח לכותרת המשרה ("${job.title}").`
        : `Align your CV headline with the job title ("${job.title}").`,
    });
  }
  if (resumeText.length > 9000) {
    out.push({
      kind: "format",
      text: he ? 'קו"ח ארוכים מדי — נסה לקצר לעמוד עד שניים.' : "Your CV is long — aim for one to two pages.",
    });
  }
  return out;
}

export async function generateCvSuggestions(
  input: CvSuggestionInput,
  provider: LLMProvider = getLLMProvider(),
): Promise<{ provider: string; suggestions: CvSuggestion[] }> {
  if (provider.name === "mock") return { provider: "mock", suggestions: heuristicSuggestions(input) };
  try {
    const raw = await provider.complete(
      [
        {
          role: "system",
          content:
            'You are a senior tech recruiter in Israel. Give concrete, honest CV improvement suggestions for a specific job. Never invent experience. Respond as JSON: {"suggestions":[{"kind":"missing_skill|keyword|impact|format|summary","text":string}]}. Max 6 items.',
        },
        {
          role: "user",
          content: `Language: ${input.locale === "he" ? "Hebrew" : "English"}\n\nJOB: ${input.job.title}\nStack: ${input.job.techStack.join(", ")}\n${input.job.description.slice(0, 4000)}\n\nCV:\n${input.resumeText.slice(0, 8000)}`,
        },
      ],
      { json: true },
    );
    const parsed = JSON.parse(raw) as { suggestions?: CvSuggestion[] };
    return { provider: provider.name, suggestions: (parsed.suggestions ?? []).slice(0, 6) };
  } catch {
    return { provider: "heuristic-fallback", suggestions: heuristicSuggestions(input) };
  }
}
