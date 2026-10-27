/** Polite HTTP for public job-board APIs: identifies itself, times out, and retries a transient failure once. */
export const USER_AGENT =
  "job-hunt-bot/1.0 (+https://job-hunt-nine-orcin.vercel.app; aggregates public job-board APIs)";

const RETRY_DELAY_MS = 3_000;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getJson<T>(url: string, label: string, fetchImpl: typeof fetch = fetch): Promise<T> {
  const attempt = () =>
    fetchImpl(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
  let res: Response;
  try {
    res = await attempt();
    if (res.status === 429 || res.status >= 500) {
      await sleep(RETRY_DELAY_MS);
      res = await attempt();
    }
  } catch {
    // Timeout or network error: one retry after a pause.
    await sleep(RETRY_DELAY_MS);
    res = await attempt();
  }
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  return (await res.json()) as T;
}
