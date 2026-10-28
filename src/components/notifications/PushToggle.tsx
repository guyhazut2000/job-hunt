"use client";

import { useEffect, useState, useTransition } from "react";
import { BellOff, BellRing, Send } from "lucide-react";
import { removePushSubscription, savePushSubscription, sendTestNotification } from "@/app/notification-actions";
import { Button } from "@/components/ui/button";

type Status = "loading" | "unsupported" | "denied" | "off" | "on";

interface Labels {
  pushOn: string;
  pushOff: string;
  pushEnabled: string;
  pushUnsupported: string;
  pushNotConfigured: string;
  pushDenied: string;
  pushError: string;
  sendTest: string;
  testSent: string;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac/.test(ua)
        ? "Mac"
        : /Windows/.test(ua)
          ? "Windows"
          : "Linux";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  return `${browser} · ${os}`;
}

/** Enable / disable web push on this device. `publicKey` is null when VAPID isn't configured. */
export function PushToggle({
  publicKey,
  labels,
  hasChannels,
}: {
  publicKey: string | null;
  labels: Labels;
  hasChannels: boolean;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (!cancelled) setStatus(sub ? "on" : "off");
    })().catch(() => setStatus("off"));
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = () =>
    startTransition(async () => {
      setMessage(null);
      try {
        if (!publicKey) return;
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setStatus(perm === "denied" ? "denied" : "off");
          return;
        }
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          }));
        const r = await savePushSubscription(sub.toJSON(), deviceLabel());
        if (!r.ok) throw new Error("save failed");
        setStatus("on");
      } catch {
        setMessage(labels.pushError);
      }
    });

  const disable = () =>
    startTransition(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe().catch(() => undefined);
      }
      setStatus("off");
    });

  const test = () =>
    startTransition(async () => {
      await sendTestNotification();
      setMessage(labels.testSent);
    });

  let note: string | null = null;
  if (!publicKey) note = labels.pushNotConfigured;
  else if (status === "unsupported") note = labels.pushUnsupported;
  else if (status === "denied") note = labels.pushDenied;

  return (
    <div className="flex flex-col gap-2">
      {note ? (
        <p className="text-muted-foreground text-sm" data-testid="push-note">
          {note}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {status === "on" ? (
            <>
              <span className="text-fit inline-flex items-center gap-1 text-sm font-semibold">
                <BellRing className="size-4" aria-hidden />
                {labels.pushEnabled}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={disable} disabled={pending}>
                <BellOff data-icon="inline-start" aria-hidden />
                {labels.pushOff}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={enable}
              disabled={pending || status === "loading"}
              data-testid="push-enable"
            >
              <BellRing data-icon="inline-start" aria-hidden />
              {labels.pushOn}
            </Button>
          )}
        </div>
      )}
      {(hasChannels || status === "on") && (
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={test} disabled={pending} data-testid="send-test">
            <Send data-icon="inline-start" aria-hidden className="rtl:-scale-x-100" />
            {labels.sendTest}
          </Button>
        </div>
      )}
      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
    </div>
  );
}
