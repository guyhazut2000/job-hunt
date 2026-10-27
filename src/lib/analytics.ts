/**
 * Provider-agnostic analytics hooks. Wire a real sink (PostHog, GA4, Segment, Plausible)
 * by setting NEXT_PUBLIC_ANALYTICS_PROVIDER and implementing it in `sinks` below.
 * Never send CV contents or other PII as event properties.
 */
export type AnalyticsEvent =
  | "signup"
  | "login"
  | "job_view"
  | "job_apply_click"
  | "job_saved"
  | "application_status_changed"
  | "cv_uploaded"
  | "cv_suggestions_generated"
  | "upgrade_clicked";

type Props = Record<string, string | number | boolean | null | undefined>;
type Sink = (event: AnalyticsEvent, props: Props) => void;

const sinks: Record<string, Sink> = {
  console: (event, props) => {
    if (process.env.NODE_ENV !== "test") console.info(`[analytics] ${event}`, props);
  },
  none: () => {},
};

export function track(event: AnalyticsEvent, props: Props = {}) {
  const provider = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER ?? "console";
  try {
    (sinks[provider] ?? sinks.none)(event, props);
  } catch {
    // analytics must never break the product
  }
}
