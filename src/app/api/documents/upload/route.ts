import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ALLOWED_MIMES, MAX_DOCUMENT_BYTES, UPLOADS_PER_HOUR } from "@/lib/documents/constants";
import { takeToken } from "@/lib/documents/rate-limit";
import { quotaState } from "@/lib/documents/server";
import { storageDriver } from "@/lib/documents/storage";
import { checkQuota, ownsKey } from "@/lib/documents/validate";

/**
 * Issues a short-lived client token so the browser can upload straight to the private Blob store.
 * Only for the signed-in user's own key prefix, allowed types, max 10MB, within quota and rate limits.
 * The upload is not a document until /documents finalize verifies the stored bytes.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (storageDriver() !== "blob") return NextResponse.json({ error: "storage" }, { status: 503 });

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (body.type !== "blob.generate-client-token") {
    // We finalize from the client (works in every environment), so completion callbacks are ignored.
    return NextResponse.json({ ok: true });
  }
  if (!takeToken(`doc-upload:${userId}`, 20, 10 * 60_000)) {
    return NextResponse.json({ error: "rateLimited" }, { status: 429 });
  }
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!ownsKey(userId, pathname)) throw new Error("forbidden");
        const size = Number(JSON.parse(clientPayload ?? "{}").size ?? 0);
        const q = await quotaState(userId);
        const replacing = Number(JSON.parse(clientPayload ?? "{}").replacingBytes ?? 0);
        const err = checkQuota(q, size, replacing, UPLOADS_PER_HOUR);
        if (err) throw new Error(err);
        return {
          allowedContentTypes: [...ALLOWED_MIMES],
          maximumSizeInBytes: MAX_DOCUMENT_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
          validUntil: Date.now() + 10 * 60_000,
        };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (e) {
    const msg = (e as Error).message;
    const known = ["forbidden", "quota", "tooMany", "rateLimited"].includes(msg) ? msg : "upload";
    return NextResponse.json({ error: known }, { status: known === "forbidden" ? 403 : 400 });
  }
}
