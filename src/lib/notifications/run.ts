import { processDeliveries } from "./deliver";
import { runFollowUpReminders, runSavedJobClosed } from "./reminders";
import { runFollowedCompanyAlerts } from "./company-follow";
import { runSavedSearchAlerts } from "./saved-search";
import { runScanFailureAlerts } from "./scan-failures";

/** Everything the notify cron does; each step is isolated so one failure doesn't stop the rest. */
export async function runNotifications(now = new Date()) {
  const safe = <T>(p: Promise<T>) => p.catch((e: unknown) => ({ error: e instanceof Error ? e.message : "error" }));
  const searches = await safe(runSavedSearchAlerts(now));
  const companies = await safe(runFollowedCompanyAlerts(now));
  const scanFailures = await safe(runScanFailureAlerts(now));
  const followUps = await safe(runFollowUpReminders(now));
  const closed = await safe(runSavedJobClosed(now));
  const deliveries = await safe(processDeliveries({ now }));
  return { searches, companies, scanFailures, followUps, closed, deliveries };
}
