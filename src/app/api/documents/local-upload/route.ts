import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { keyPrefix, MAX_DOCUMENT_BYTES, MIME_FOR_EXT } from "@/lib/documents/constants";
import { takeToken } from "@/lib/documents/rate-limit";
import { storageDriver, writeObject } from "@/lib/documents/storage";
import { extOf, precheckUpload } from "@/lib/documents/validate";

/** Development-only upload path (local disk driver). Disabled whenever Blob storage is configured. */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (storageDriver() !== "local") return NextResponse.json({ error: "storage" }, { status: 404 });
  if (!takeToken(`doc-upload:${userId}`, 20, 10 * 60_000)) {
    return NextResponse.json({ error: "rateLimited" }, { status: 429 });
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "noFile" }, { status: 400 });
  const err = precheckUpload(file);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  const ext = extOf(file.name) === "jpeg" ? "jpg" : extOf(file.name);
  const key = `${keyPrefix(userId)}${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_DOCUMENT_BYTES) return NextResponse.json({ error: "tooLarge" }, { status: 400 });
  await writeObject(key, buf, MIME_FOR_EXT[ext] ?? "application/octet-stream");
  return NextResponse.json({ key });
}
