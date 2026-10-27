import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { GMAIL_SCOPE, OAUTH_COOKIE, googleRedirectUri, isGmailConfigured, requestOrigin } from "@/lib/email/config";
import { encryptSecret } from "@/lib/email/crypto";
import { exchangeGoogleCode, gmailProfileEmail } from "@/lib/email/providers/gmail";
import { getSettings } from "@/lib/email/scan";

export const dynamic = "force-dynamic";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function GET(req: NextRequest) {
  const origin = requestOrigin(req);
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/settings/email?${q}`, origin));
    res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/email/google" });
    return res;
  };
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", origin));
  if (!isGmailConfigured()) return back("error=not_configured");

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return back("error=denied");
  const code = params.get("code");
  const state = params.get("state");
  const [cookieState, verifier, cookieUser] = (req.cookies.get(OAUTH_COOKIE)?.value ?? "").split(".");
  if (!code || !state || !cookieState || !verifier || !same(state, cookieState) || cookieUser !== session.user.id)
    return back("error=state");

  try {
    const tokens = await exchangeGoogleCode(code, googleRedirectUri(origin), verifier);
    const granted = (tokens.scope ?? "").split(" ");
    if (!granted.includes(GMAIL_SCOPE)) return back("error=scope");
    if (!tokens.refresh_token) return back("error=no_refresh_token");
    const emailAddress = await gmailProfileEmail(tokens.access_token);
    const userId = session.user.id;
    await db.emailAccount.upsert({
      where: { userId_provider: { userId, provider: "GMAIL" } },
      update: { emailAddress, refreshTokenEnc: encryptSecret(tokens.refresh_token), scope: GMAIL_SCOPE },
      create: {
        userId,
        provider: "GMAIL",
        emailAddress,
        refreshTokenEnc: encryptSecret(tokens.refresh_token),
        scope: GMAIL_SCOPE,
      },
    });
    await getSettings(userId);
    await db.emailSyncSettings.update({ where: { userId }, data: { lastScanError: null } });
    return back("connected=1");
  } catch (e) {
    console.error("[email-sync] oauth callback failed", { name: (e as Error).name, message: (e as Error).message });
    return back("error=exchange");
  }
}
