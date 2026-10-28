"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { geocodeAddress } from "@/lib/geo/nominatim";
import { requireUser } from "@/lib/session";

const MAX_PLACES = 10;

const placeSchema = z.object({
  label: z.string().trim().min(1).max(40),
  address: z.string().trim().min(2).max(200),
});

export type PlaceFormState = { ok?: boolean; error?: "invalid" | "not_found" | "limit" } | undefined;

function revalidate() {
  revalidatePath("/settings/places");
  revalidatePath("/jobs");
}

/** Add a saved commute origin. The address is geocoded server-side (Nominatim, cached, throttled). */
export async function addPlace(_: PlaceFormState, formData: FormData): Promise<PlaceFormState> {
  const user = await requireUser();
  const parsed = placeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const count = await db.savedPlace.count({ where: { userId: user.id } });
  if (count >= MAX_PLACES) return { error: "limit" };
  const hit = await geocodeAddress(parsed.data.address);
  if (!hit) return { error: "not_found" };
  await db.savedPlace.create({
    data: {
      userId: user.id,
      label: parsed.data.label,
      address: parsed.data.address,
      lat: hit.lat,
      lng: hit.lng,
      isDefault: count === 0,
    },
  });
  revalidate();
  return { ok: true };
}

export async function removePlace(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const place = await db.savedPlace.findFirst({ where: { id, userId: user.id }, select: { isDefault: true } });
  if (!place) return;
  await db.savedPlace.delete({ where: { id } });
  if (place.isDefault) {
    const next = await db.savedPlace.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    if (next) await db.savedPlace.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  revalidate();
}

export async function makeDefaultPlace(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const place = await db.savedPlace.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!place) return;
  await db.$transaction([
    db.savedPlace.updateMany({ where: { userId: user.id }, data: { isDefault: false } }),
    db.savedPlace.update({ where: { id }, data: { isDefault: true } }),
  ]);
  revalidate();
}
