import { ArrowRight, Lock, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { disconnectEmail } from "@/app/email-actions";
import { EmailSettingsForm } from "@/components/email/EmailSettingsForm";
import { ScanPanel } from "@/components/email/ScanPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { isGmailConfigured, isOutlookConfigured } from "@/lib/email/config";
import { formatIsraelTime } from "@/lib/email/format";
import { getSettings, type ScanSummary } from "@/lib/email/scan";
import { clampThreshold } from "@/lib/email/score";
import { getLocale } from "@/lib/i18n";
import { emailSyncStrings } from "@/lib/i18n/email-sync";
import { requireUser } from "@/lib/session";
import { localizedTitle } from "@/lib/i18n/titles";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("emailSync");

export default async function EmailSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const user = await requireUser("/settings/email");
  const locale = await getLocale();
  const s = emailSyncStrings[locale];
  const sp = await searchParams;
  const [settings, accounts] = await Promise.all([
    getSettings(user.id),
    db.emailAccount.findMany({ where: { userId: user.id }, select: { provider: true, emailAddress: true } }),
  ]);
  const gmailConfigured = isGmailConfigured();
  const gmail = accounts.find((a) => a.provider === "GMAIL");
  const connected = Boolean(gmail && gmailConfigured);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="rule-double flex flex-col gap-2 pb-4">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-8 w-fit items-center gap-1 text-sm"
        >
          <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
          {s.back}
        </Link>
        <p className="kicker">{s.kicker}</p>
        <h1 className="text-title font-black">{s.title}</h1>
        <p className="text-muted-foreground max-w-prose leading-relaxed">{s.lead}</p>
      </header>

      {sp.connected && (
        <p role="status" className="border-fit/40 bg-fit-soft text-fit rounded-md border p-3 text-sm font-semibold">
          {s.connectedOk}
        </p>
      )}
      {sp.error && (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
        >
          {s.errors[sp.error] ?? s.errors.exchange}
        </p>
      )}

      <section aria-labelledby="conn-h" className="card flex flex-col gap-4">
        <h2 id="conn-h" className="font-heading text-lg font-bold">
          {s.connection}
        </h2>

        <div className="flex flex-col gap-3 rounded-md border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="bg-muted grid size-10 shrink-0 place-items-center rounded-md">
                <Mail className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {s.gmail}
                  {gmailConfigured ? (
                    <Badge variant="outline" className="gap-1">
                      <Lock className="size-3" aria-hidden />
                      {s.readOnly}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">{s.comingSoon}</Badge>
                  )}
                </p>
                {connected ? (
                  <p className="text-muted-foreground truncate text-sm">
                    {s.connectedAs}
                    <bdi dir="ltr">{gmail!.emailAddress}</bdi>
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">{gmailConfigured ? s.connectHint : s.notConfigured}</p>
                )}
              </div>
            </div>
            {gmailConfigured &&
              (connected ? (
                <form action={disconnectEmail.bind(null, "GMAIL")}>
                  <Button type="submit" variant="outline">
                    {s.disconnect}
                  </Button>
                </form>
              ) : (
                <Button asChild>
                  {/* Full navigation (not client routing): this redirects to Google. */}
                  <a href="/api/email/google/connect">{s.connect}</a>
                </Button>
              ))}
          </div>
          {!gmailConfigured && <p className="text-muted-foreground text-xs">{s.notConfiguredHint}</p>}
          {connected && <p className="text-muted-foreground text-xs">{s.disconnectHint}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed p-4 opacity-75">
          <div className="flex items-center gap-3">
            <span className="bg-muted grid size-10 shrink-0 place-items-center rounded-md">
              <Mail className="size-5" aria-hidden />
            </span>
            <div>
              <p className="flex items-center gap-2 font-semibold">
                {s.outlook}
                <Badge variant="secondary">{s.comingSoon}</Badge>
              </p>
              <p className="text-muted-foreground text-sm">{s.outlookHint}</p>
            </div>
          </div>
          <Button variant="outline" disabled={!isOutlookConfigured()}>
            {s.comingSoon}
          </Button>
        </div>
      </section>

      <section aria-labelledby="scan-h" className="card flex flex-col gap-4">
        <h2 id="scan-h" className="font-heading text-lg font-bold">
          {s.scan}
        </h2>
        <ScanPanel
          s={s}
          enabled={connected}
          lastScanLabel={settings.lastScanAt ? formatIsraelTime(settings.lastScanAt, locale) : null}
          summary={(settings.lastScanSummary as unknown as ScanSummary | null) ?? null}
          error={settings.lastScanError}
        />
      </section>

      <section aria-labelledby="settings-h" className="card flex flex-col gap-4">
        <h2 id="settings-h" className="font-heading text-lg font-bold">
          {s.settings}
        </h2>
        <EmailSettingsForm
          s={s}
          initial={{
            lookbackDays: settings.lookbackDays,
            frequency: settings.frequency,
            autoApplyEnabled: settings.autoApplyEnabled,
            autoApplyThreshold: clampThreshold(settings.autoApplyThreshold),
            detectStatusUpdates: settings.detectStatusUpdates,
          }}
        />
      </section>

      <section aria-labelledby="privacy-h" className="bg-muted/50 flex flex-col gap-3 rounded-lg border p-5">
        <h2 id="privacy-h" className="flex items-center gap-2 font-bold">
          <ShieldCheck className="text-fit size-5" aria-hidden />
          {s.privacyTitle}
        </h2>
        <ul className="text-foreground/85 flex list-disc flex-col gap-1.5 ps-5 text-sm leading-relaxed">
          {s.privacy.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
