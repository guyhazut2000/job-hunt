import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isPreviewable } from "@/lib/documents/constants";
import { verifyFileToken } from "@/lib/documents/signing";
import { streamObject } from "@/lib/documents/storage";
import { contentDisposition } from "@/lib/documents/validate";

/**
 * Stream a document to its owner. Requires the session, ownership, and a short-lived signed token
 * (see signing.ts). `?download=1` forces a download; otherwise PDFs/images render inline.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const url = new URL(request.url);
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") ?? "";
  if (!verifyFileToken(id, userId, exp, sig)) return new Response("Link expired", { status: 403 });

  const doc = await db.document.findFirst({
    where: { id, userId },
    select: { fileName: true, mimeType: true, sizeBytes: true, storageKey: true },
  });
  if (!doc) return new Response("Not found", { status: 404 });
  const stream = await streamObject(doc.storageKey);
  if (!stream) return new Response("Not found", { status: 404 });

  const inline = url.searchParams.get("download") !== "1" && isPreviewable(doc.mimeType);
  return new Response(stream, {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(doc.sizeBytes),
      "Content-Disposition": contentDisposition(inline ? "inline" : "attachment", doc.fileName),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Referrer-Policy": "no-referrer",
    },
  });
}
