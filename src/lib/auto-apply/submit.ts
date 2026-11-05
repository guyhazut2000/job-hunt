/**
 * Documented application POSTs. No retries: a lost response must not file the candidate twice.
 * The API key is sent as Basic auth and is never placed in the URL or the error string.
 */
import { USER_AGENT, paceHost } from "@/lib/ingestion/http";

export type SubmitResult = { ok: true; id?: string } | { ok: false; error: string };

export function basicAuth(key: string): string {
  return `Basic ${Buffer.from(`${key}:`, "utf8").toString("base64")}`;
}

function safeError(status: number, text: string): string {
  const clipped = text
    .replace(/[A-Za-z0-9+/=_-]{24,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return clipped ? `HTTP ${status}: ${clipped}` : `HTTP ${status}`;
}

async function readError(res: Response): Promise<string> {
  try {
    return safeError(res.status, await res.text());
  } catch {
    return `HTTP ${res.status}`;
  }
}

function idFrom(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const rec = body as Record<string, unknown>;
  for (const key of ["id", "applicationId", "application_id"]) {
    if (typeof rec[key] === "string" || typeof rec[key] === "number") return String(rec[key]);
  }
  const results = rec.results;
  if (results && typeof results === "object") {
    const id = (results as { id?: unknown; applicationId?: unknown }).applicationId ?? (results as { id?: unknown }).id;
    if (typeof id === "string" || typeof id === "number") return String(id);
  }
  return undefined;
}

/**
 * POST https://boards-api.greenhouse.io/v1/boards/{board}/jobs/{id}
 * Basic username = the employer's Job Board API key, empty password.
 */
export async function submitGreenhouse(opts: {
  board: string;
  jobId: string;
  apiKey: string;
  body: Record<string, unknown>;
  fetchImpl?: typeof fetch;
}): Promise<SubmitResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(opts.board)}/jobs/${encodeURIComponent(opts.jobId)}`;
  await paceHost(new URL(url).host, opts.fetchImpl ? 0 : 2000);
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: {
        authorization: basicAuth(opts.apiKey),
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": USER_AGENT,
      },
      body: JSON.stringify(opts.body),
      signal: AbortSignal.timeout(20_000),
      redirect: "error",
    });
  } catch {
    return { ok: false, error: "network" };
  }
  if (!res.ok) return { ok: false, error: await readError(res) };
  try {
    return { ok: true, id: idFrom(await res.json()) };
  } catch {
    return { ok: true };
  }
}

export interface AshbyUpload {
  part: string;
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}

/**
 * POST https://api.ashbyhq.com/applicationForm.submit as multipart/form-data.
 * Requires the employer's key with candidatesWrite. One attempt.
 */
export async function submitAshby(opts: {
  apiKey: string;
  jobPostingId: string;
  submissions: { path: string; value: unknown }[];
  files: AshbyUpload[];
  fetchImpl?: typeof fetch;
}): Promise<SubmitResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = "https://api.ashbyhq.com/applicationForm.submit";
  await paceHost(new URL(url).host, opts.fetchImpl ? 0 : 2000);
  const form = new FormData();
  form.set("jobPostingId", opts.jobPostingId);
  form.set("applicationForm", JSON.stringify({ fieldSubmissions: opts.submissions }));
  for (const file of opts.files) {
    form.set(file.part, new Blob([Buffer.from(file.bytes)], { type: file.mimeType }), file.filename);
  }
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: {
        authorization: basicAuth(opts.apiKey),
        accept: "application/json",
        "user-agent": USER_AGENT,
      },
      body: form,
      signal: AbortSignal.timeout(30_000),
      redirect: "error",
    });
  } catch {
    return { ok: false, error: "network" };
  }
  if (!res.ok) return { ok: false, error: await readError(res) };
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: "bad_response" };
  }
  const body = json as { success?: boolean; errors?: unknown };
  if (body.success === false)
    return { ok: false, error: safeError(200, JSON.stringify(body.errors ?? "rejected").slice(0, 300)) };
  return { ok: true, id: idFrom(json) };
}
