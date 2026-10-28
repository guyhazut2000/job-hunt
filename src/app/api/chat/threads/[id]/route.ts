import { auth } from "@/auth";
import { deleteThread, threadMessages } from "@/lib/chat/repo";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = (await auth())?.user?.id;
  if (!userId) return Response.json({ error: "auth" }, { status: 401 });
  const t = await threadMessages(userId, (await params).id);
  return t ? Response.json(t) : Response.json({ error: "not_found" }, { status: 404 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = (await auth())?.user?.id;
  if (!userId) return Response.json({ error: "auth" }, { status: 401 });
  return (await deleteThread(userId, (await params).id))
    ? Response.json({ ok: true })
    : Response.json({ error: "not_found" }, { status: 404 });
}
