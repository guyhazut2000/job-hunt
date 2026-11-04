"use server";

import { z } from "zod";
import { runAts, type AtsRun } from "@/lib/ats/server";
import { requireUser } from "@/lib/session";

const MAX_JD = 12_000;
const input = z.object({
  title: z.string().max(200).default(""),
  text: z.string().min(20).max(MAX_JD),
  template: z.string().max(40).nullish(),
});

/** Check the CV against a pasted job description. The text is never stored. */
export async function checkPastedJob(raw: {
  title?: string;
  text: string;
  template?: string | null;
}): Promise<{ ok: true; run: AtsRun } | { ok: false }> {
  const user = await requireUser("/cv/ats");
  const p = input.safeParse(raw);
  if (!p.success) return { ok: false };
  const run = await runAts(user.id, {
    template: p.data.template,
    job: { title: p.data.title.trim(), tech: [], text: p.data.text },
  });
  return { ok: true, run };
}
