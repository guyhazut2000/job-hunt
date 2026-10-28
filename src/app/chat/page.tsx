import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { getDictionary } from "@/lib/i18n";
import { chatStrings } from "@/lib/i18n/chat";

export const metadata = { title: "Assistant" };

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ thread?: string | string[] }> }) {
  const [{ locale }, session, sp] = await Promise.all([getDictionary(), auth(), searchParams]);
  if (!session?.user?.id) redirect("/login?next=/chat");
  const s = chatStrings(locale);
  const thread = typeof sp.thread === "string" && /^[\w-]{8,40}$/.test(sp.thread) ? sp.thread : null;
  return (
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-3">
      <h1 className="sr-only">{s.title}</h1>
      <ChatPanel locale={locale} variant="page" initialThreadId={thread} />
    </div>
  );
}
