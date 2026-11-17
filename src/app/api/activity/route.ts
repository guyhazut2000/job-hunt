import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canViewActivity } from "@/lib/activity/access";
import { cleanPath } from "@/lib/activity/context";
import { parseActivityFilters, listActivity } from "@/lib/activity/query";
import { recordActivity } from "@/lib/activity/record";

export const dynamic = "force-dynamic";

/**
 * Page-view beacon (navigator.sendBeacon, text/plain JSON `{ "path": "/jobs" }`).
 * Signed-in users only; bots and invalid paths are dropped. Always 204 so it never affects navigation.
 */
export async function POST(req: Request) {
  const text = await req.text().catch(() => "");
  if (!text || text.length > 512) return new Response(null, { status: 204 });
  let path: string | null = null;
  try {
    path = cleanPath((JSON.parse(text) as { path?: unknown })?.path);
  } catch {
    // ignore
  }
  if (!path || path.startsWith("/admin/activity")) return new Response(null, { status: 204 });
  const session = await auth();
  if (!session?.user?.id) return new Response(null, { status: 204 });
  await recordActivity({ type: "page_view", userId: session.user.id, email: session.user.email, path });
  return new Response(null, { status: 204 });
}

/** JSON view of the log for the allowlisted owner only (same filters as /admin/activity). Everyone else: 403. */
export async function GET(req: Request) {
  const session = await auth();
  if (!canViewActivity(session?.user)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  return NextResponse.json(await listActivity(parseActivityFilters(sp)));
}
