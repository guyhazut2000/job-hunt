import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { loginPath } from "@/lib/safe-next";
import { redirect } from "next/navigation";

/** Only these accounts can see the activity log. Override with ACTIVITY_LOG_VIEWERS (comma-separated emails). */
export const DEFAULT_ACTIVITY_VIEWERS = ["guyhazut2000@gmail.com"];

export function activityViewers(env: Record<string, string | undefined> = process.env): string[] {
  const raw = env.ACTIVITY_LOG_VIEWERS?.trim();
  const list = raw ? raw.split(",") : DEFAULT_ACTIVITY_VIEWERS;
  return list.map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function canViewActivity(
  user: { email?: string | null } | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const email = user?.email?.trim().toLowerCase();
  return !!email && activityViewers(env).includes(email);
}

/** Page guard: signed-out → login; anyone but the allowlisted owner → 404 (the page does not exist for them). */
export async function requireActivityViewer(next = "/admin/activity") {
  const session = await auth();
  if (!session?.user?.id) redirect(loginPath(next));
  if (!canViewActivity(session.user)) notFound();
  return session.user;
}
