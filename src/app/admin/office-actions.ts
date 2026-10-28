"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { geocodeJobs } from "@/lib/geo/backfill";
import { geocodeAddress } from "@/lib/geo/nominatim";
import { requireAdmin } from "@/lib/session";

const schema = z.object({
  companyId: z.string().regex(/^[a-z0-9]{8,40}$/i),
  officeAddress: z.string().trim().max(200).optional().default(""),
  officeCity: z.string().trim().max(60).optional().default(""),
});

/** Admin: pin a company's office for the jobs map (empty address clears it), then re-geocode its jobs. */
export async function adminSetCompanyOffice(formData: FormData) {
  await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { companyId, officeAddress, officeCity } = parsed.data;
  if (!officeAddress) {
    await db.company.update({
      where: { id: companyId },
      data: { officeAddress: null, officeLat: null, officeLng: null, officeCity: null },
    });
  } else {
    const hit = await geocodeAddress(officeAddress);
    if (!hit) return; // not found: keep the current value
    await db.company.update({
      where: { id: companyId },
      data: { officeAddress, officeLat: hit.lat, officeLng: hit.lng, officeCity: officeCity || null },
    });
  }
  await geocodeJobs();
  revalidatePath("/admin");
  revalidatePath("/jobs");
}
