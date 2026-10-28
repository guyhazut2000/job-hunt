import { NextResponse, type NextRequest } from "next/server";
import { parseDeparture, parseLatLng } from "@/lib/commute/keys";
import { getTransitRoute } from "@/lib/commute/service";

export const maxDuration = 30;

/**
 * GET /api/commute/route?from=lat,lng&to=lat,lng&dep=sun-thu-0830
 * One public-transport itinerary (legs) for the map panel. The origin is rounded to the ~200 m
 * grid by the service before routing or caching; nothing is stored about the caller.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const from = parseLatLng(sp.get("from"));
  const to = parseLatLng(sp.get("to"));
  if (!from || !to) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const res = await getTransitRoute({ origin: from, dest: to, departure: parseDeparture(sp.get("dep")) });
  return NextResponse.json(res, {
    headers: { "Cache-Control": res.status === "unavailable" ? "no-store" : "private, max-age=3600" },
  });
}
