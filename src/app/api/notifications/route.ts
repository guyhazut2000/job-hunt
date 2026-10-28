import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Bell data: unread count + the latest few notifications. */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ unread: 0, items: [] }, { status: 401 });
  const [unread, items] = await Promise.all([
    db.notification.count({ where: { userId, readAt: null } }),
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, kind: true, title: true, body: true, readAt: true, createdAt: true },
    }),
  ]);
  return NextResponse.json(
    { unread, items: items.map((n) => ({ ...n, read: !!n.readAt, readAt: undefined })) },
    { headers: { "cache-control": "no-store" } },
  );
}
