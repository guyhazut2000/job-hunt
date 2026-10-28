import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Mark a notification read and go to its target (used by the bell, push and Telegram links). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  const base = new URL(req.url);
  if (!userId) return NextResponse.redirect(new URL("/login", base));
  const n = await db.notification.findFirst({ where: { id, userId }, select: { url: true, readAt: true } });
  if (!n) return NextResponse.redirect(new URL("/notifications", base));
  if (!n.readAt) await db.notification.update({ where: { id }, data: { readAt: new Date() } });
  // Only same-site paths (never "//host" or absolute URLs) — no open redirect.
  const target = n.url && n.url.startsWith("/") && !n.url.startsWith("//") ? n.url : "/notifications";
  return NextResponse.redirect(new URL(target, base));
}
