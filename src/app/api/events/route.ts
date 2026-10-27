import { track } from "@/lib/analytics";
import { parseClickEvent } from "@/lib/events";

/** Outbound-click beacons (navigator.sendBeacon sends text/plain JSON). Always 204; never blocks navigation. */
export async function POST(req: Request) {
  const text = await req.text().catch(() => "");
  if (text.length > 512) return new Response(null, { status: 204 });
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    // ignore
  }
  const e = parseClickEvent(body);
  if (e) track(e.event, { jobId: e.jobId, kind: e.kind, placement: e.placement });
  return new Response(null, { status: 204 });
}
