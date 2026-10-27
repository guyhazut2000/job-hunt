"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeLinkedinCompanyUrl } from "@/lib/linkedin/company";
import { requireAdmin } from "@/lib/session";

const schema = z.object({
  companyId: z.string().regex(/^[a-z0-9]{8,40}$/i),
  linkedinUrl: z.string().trim().max(300).optional().default(""),
});

/** Admin: set (or clear) a company's LinkedIn page. Stored normalized; we never fetch it. */
export async function adminSetCompanyLinkedin(formData: FormData) {
  await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { companyId, linkedinUrl } = parsed.data;
  const url = linkedinUrl ? normalizeLinkedinCompanyUrl(linkedinUrl) : null;
  if (linkedinUrl && !url) return; // invalid input: keep the current value
  const c = await db.company.update({ where: { id: companyId }, data: { linkedinUrl: url }, select: { slug: true } });
  revalidatePath("/admin");
  revalidatePath("/companies");
  revalidatePath(`/companies/${c.slug}`);
}
