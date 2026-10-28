import { db } from "@/lib/db";
import { type LatLng, parseLatLng, roundOrigin } from "./keys";

export interface ResolvedOrigin {
  point: LatLng;
  source: "here" | "saved";
  placeId?: string;
  label?: string;
}

/**
 * The commute origin for a request: an ad-hoc grid-rounded `from` point, else a saved place the
 * user owns (`origin` id), else (when `useDefault`) the user's default saved place.
 */
export async function resolveOrigin(
  f: { from?: string; origin?: string },
  userId: string | undefined,
  useDefault = false,
): Promise<ResolvedOrigin | null> {
  const here = parseLatLng(f.from);
  if (here) return { point: roundOrigin(here), source: "here" };
  if (!userId || f.origin === "none") return null;
  if (!f.origin && !useDefault) return null;
  const place = await db.savedPlace.findFirst({
    where: f.origin ? { id: f.origin, userId } : { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { id: true, label: true, lat: true, lng: true },
  });
  if (!place) return null;
  return { point: { lat: place.lat, lng: place.lng }, source: "saved", placeId: place.id, label: place.label };
}

export async function listSavedPlaces(userId: string | undefined) {
  if (!userId) return [];
  return db.savedPlace.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { id: true, label: true, address: true, isDefault: true },
  });
}
