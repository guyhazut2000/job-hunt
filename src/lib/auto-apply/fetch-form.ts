/**
 * Load the public Greenhouse question list, or an Ashby form when that employer's key is set.
 * Failures become null so the caller falls back to a profile packet and a handoff.
 */
import { USER_AGENT, requestJson } from "@/lib/ingestion/http";
import { basicAuth } from "./submit";
import { parseAshbyForm, parseGreenhouseForm } from "./fields";
import type { ApplyField } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function loadGreenhouseFields(
  board: string,
  jobId: string,
  fetchImpl?: typeof fetch,
): Promise<ApplyField[] | null> {
  if (!board.trim() || !/^\d+$/.test(jobId)) return null;
  try {
    const body = await requestJson<unknown>(
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${encodeURIComponent(jobId)}?questions=true`,
      `Greenhouse form ${board}`,
      { fetchImpl, retries: 1, minIntervalMs: 1000 },
    );
    const fields = parseGreenhouseForm(body);
    return fields.length ? fields : null;
  } catch {
    return null;
  }
}

/** POST jobPosting.info. The key needs jobsRead. A miss returns null (handoff). */
export async function loadAshbyFields(
  apiKey: string,
  jobPostingId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ApplyField[] | null> {
  if (!UUID.test(jobPostingId)) return null;
  try {
    const res = await fetchImpl("https://api.ashbyhq.com/jobPosting.info", {
      method: "POST",
      headers: {
        authorization: basicAuth(apiKey),
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": USER_AGENT,
      },
      body: JSON.stringify({ jobPostingId }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success?: boolean; results?: { applicationFormDefinition?: unknown } };
    if (json.success === false) return null;
    return parseAshbyForm(json.results?.applicationFormDefinition);
  } catch {
    return null;
  }
}
