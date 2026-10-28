import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ChatRepo } from "./handler";

/** Prisma-backed chat persistence; every query is scoped to the owner. */
export const prismaChatRepo: ChatRepo = {
  async thread(userId, title, threadId) {
    if (threadId) {
      const t = await db.chatThread.findFirst({ where: { id: threadId, userId }, select: { id: true } });
      if (t) {
        await db.chatThread.update({ where: { id: t.id }, data: { updatedAt: new Date() } });
        return { id: t.id, created: false };
      }
    }
    const t = await db.chatThread.create({ data: { userId, title: title || "…" }, select: { id: true } });
    return { id: t.id, created: true };
  },
  async history(threadId, limit) {
    const rows = await db.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { role: true, content: true },
    });
    return rows.reverse();
  },
  async add(threadId, role, content, parts) {
    await db.chatMessage.create({
      data: {
        threadId,
        role,
        content: content.slice(0, 8000),
        ...(parts !== undefined ? { parts: parts as Prisma.InputJsonValue } : {}),
      },
    });
  },
};

export const CHAT_THREADS_LIST = 30;

export async function listThreads(userId: string) {
  return db.chatThread.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: CHAT_THREADS_LIST,
    select: { id: true, title: true, updatedAt: true },
  });
}

/** Messages of one of the user's threads in UI-message shape, or null when not theirs. */
export async function threadMessages(userId: string, threadId: string) {
  const t = await db.chatThread.findFirst({
    where: { id: threadId, userId },
    select: {
      id: true,
      title: true,
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200,
        select: { id: true, role: true, content: true, parts: true },
      },
    },
  });
  if (!t) return null;
  return {
    id: t.id,
    title: t.title,
    messages: t.messages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      parts: Array.isArray(m.parts) ? m.parts : [{ type: "text", text: m.content }],
    })),
  };
}

export async function deleteThread(userId: string, threadId: string): Promise<boolean> {
  const r = await db.chatThread.deleteMany({ where: { id: threadId, userId } });
  return r.count > 0;
}
