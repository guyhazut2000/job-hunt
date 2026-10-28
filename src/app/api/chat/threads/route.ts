import { auth } from "@/auth";
import { chatIsLive } from "@/lib/chat/live";
import { listThreads } from "@/lib/chat/repo";

export async function GET() {
  const userId = (await auth())?.user?.id;
  if (!userId) return Response.json({ error: "auth" }, { status: 401 });
  const threads = await listThreads(userId);
  return Response.json({
    offline: !chatIsLive(),
    threads: threads.map((t) => ({ ...t, updatedAt: t.updatedAt.toISOString() })),
  });
}
