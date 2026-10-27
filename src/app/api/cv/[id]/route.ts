import { auth } from "@/auth";
import { db } from "@/lib/db";

/** Download the original uploaded CV. Owner-only. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const r = await db.resume.findFirst({
    where: { id, userId: session.user.id },
    select: { fileName: true, mimeType: true, file: { select: { data: true } } },
  });
  if (!r?.file) return new Response("Not found", { status: 404 });
  const ascii = r.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new Response(new Uint8Array(r.file.data), {
    headers: {
      "Content-Type": r.mimeType,
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(r.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
