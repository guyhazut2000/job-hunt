/** Polite HTTP for public job-board APIs: identifies itself, times out, and never retries aggressively. */
export const USER_AGENT =
  "job-hunt-bot/1.0 (+https://job-hunt-nine-orcin.vercel.app; aggregates public job-board APIs)";

export async function getJson<T>(url: string, label: string, fetchImpl: typeof fetch = fetch): Promise<T> {
  const res = await fetchImpl(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
