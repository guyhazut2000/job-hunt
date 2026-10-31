import { auth } from "@/auth";
import { parseRemoveIds } from "@/lib/applications/pending-delete";
import { db } from "@/lib/db";

/**
 * Commits pending dashboard deletes when the page is left during the undo window
 * (`navigator.sendBeacon` / keepalive fetch — a server action can't survive the page unloading).
 * Only the signed-in user's own rows; same-site session cookie, so no cross-site use.
 */
export async function POST(req: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return Response.json({ error: "auth" }, { status: 401 });
  const ids = parseRemoveIds(await req.json().catch(() => null));
  if (!ids) return Response.json({ error: "bad_request" }, { status: 400 });
  const { count } = await db.application.deleteMany({ where: { id: { in: ids }, userId } });
  return Response.json({ ok: true, count });
}
