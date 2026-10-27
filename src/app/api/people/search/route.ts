import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { PEOPLE_GROUPS } from "@/lib/people/groups";
import { searchPeople } from "@/lib/people/service";

export const dynamic = "force-dynamic";

const params = z.object({
  companyId: z.string().min(1).max(64),
  group: z.enum(PEOPLE_GROUPS as [string, ...string[]]),
  jobId: z.string().min(1).max(64).optional(),
  page: z.coerce.number().int().min(0).max(9).default(0),
});

const HTTP: Record<string, number> = {
  ok: 200,
  disabled: 503,
  not_found: 404,
  error: 502,
  rate_limited: 429,
  daily_cap: 429,
  quota: 503,
};

/** GET /api/people/search?companyId&group&jobId?&page? — auth required; the query is built server-side. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  const parsed = params.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ status: "invalid" }, { status: 400 });
  const r = await searchPeople({
    userId: session.user.id,
    companyId: parsed.data.companyId,
    group: parsed.data.group as (typeof PEOPLE_GROUPS)[number],
    jobId: parsed.data.jobId ?? null,
    page: parsed.data.page,
  });
  return NextResponse.json(r, { status: HTTP[r.status] ?? 200, headers: { "Cache-Control": "private, no-store" } });
}
