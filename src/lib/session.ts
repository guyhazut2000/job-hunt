import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loginPath } from "@/lib/safe-next";

/** The signed-in user, or a redirect to /login that returns to `next` (the current page) afterwards. */
export async function requireUser(next?: string) {
  const session = await auth();
  if (!session?.user?.id) redirect(loginPath(next));
  return session.user;
}

export async function requireAdmin(next?: string) {
  const user = await requireUser(next);
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
