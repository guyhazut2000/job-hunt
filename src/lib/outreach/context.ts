import type { Company, Job, Profile } from "@prisma/client";
import { readProfessional } from "@/lib/profile/load";
import type { OutreachContext } from "./messages";

/** Candidate facts for outreach: skills the job asks for first, so every message leads with the overlap. */
export function outreachContext(
  company: Pick<Company, "name">,
  job: Pick<Job, "title" | "applyUrl" | "techStack"> | null,
  profile: Profile | null,
  userName?: string | null,
): OutreachContext {
  const pro = readProfessional(profile);
  const names = pro.skillItems.map((s) => s.name);
  const wanted = new Set((job?.techStack ?? []).map((s) => s.toLowerCase()));
  const skills = [
    ...names.filter((n) => wanted.has(n.toLowerCase())),
    ...names.filter((n) => !wanted.has(n.toLowerCase())),
  ];
  return {
    company: company.name,
    job: job ? { title: job.title, url: job.applyUrl } : null,
    candidate: {
      name: userName,
      headline: pro.headline || null,
      years: profile?.yearsExperience ?? null,
      skills,
      desiredRole: profile?.desiredRole ?? null,
    },
  };
}
