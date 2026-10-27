import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { GMAIL_SCOPE, OAUTH_COOKIE, googleRedirectUri, isGmailConfigured, requestOrigin } from "@/lib/email/config";
import { GOOGLE_AUTH_URL } from "@/lib/email/providers/gmail";

export const dynamic = "force-dynamic";

/** Starts Google OAuth (read-only Gmail, offline access) for the signed-in user. */
export async function GET(req: Request) {
  const origin = requestOrigin(req);
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", origin));
  if (!isGmailConfigured()) return NextResponse.redirect(new URL("/settings/email?error=not_configured", origin));

  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(origin),
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();

  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_COOKIE, `${state}.${verifier}.${session.user.id}`, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/api/email/google",
    maxAge: 600,
  });
  return res;
}
