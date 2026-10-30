import { z } from "zod";

const line = (max: number) => z.string().trim().max(max);

/** Server-side validation of an edited CV posted by the editor. */
export const cvDocSchema = z.object({
  name: line(120),
  contact: z.array(line(200)).max(8),
  headline: line(200),
  summary: line(2000),
  experience: z
    .array(
      z.object({
        id: line(10),
        company: line(160),
        title: line(160),
        start: line(10),
        end: line(10),
        bullets: z.array(line(600)).max(30),
        origin: z.array(z.number().int()).max(30).optional(),
      }),
    )
    .max(30),
  skills: z.array(line(60)).max(80),
  education: z.array(z.object({ institution: line(160), title: line(160), start: line(10), end: line(10) })).max(20),
  languages: z.array(line(80)).max(10),
});
