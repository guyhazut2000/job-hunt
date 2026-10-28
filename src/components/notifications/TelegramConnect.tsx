"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Link2Off, MessageCircle } from "lucide-react";
import { createTelegramLink, disconnectTelegram } from "@/app/notification-actions";
import { Button } from "@/components/ui/button";

interface Labels {
  telegramNotConfigured: string;
  telegramConnect: string;
  telegramOpen: string;
  telegramCode: string;
  telegramExpires: string;
  telegramConnected: string;
  telegramDisconnect: string;
}

export function TelegramConnect({
  configured,
  connected,
  labels,
}: {
  configured: boolean;
  connected: number;
  labels: Labels;
}) {
  const [link, setLink] = useState<{ code: string; link: string | null } | null>(null);
  const [pending, startTransition] = useTransition();
  if (!configured) return <p className="text-muted-foreground text-sm">{labels.telegramNotConfigured}</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {connected > 0 && (
          <>
            <span className="text-fit text-sm font-semibold">
              {labels.telegramConnected.replace("{n}", String(connected))}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => startTransition(() => disconnectTelegram())}
            >
              <Link2Off data-icon="inline-start" aria-hidden />
              {labels.telegramDisconnect}
            </Button>
          </>
        )}
        <Button
          type="button"
          size="sm"
          variant={connected ? "ghost" : "default"}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await createTelegramLink();
              if ("code" in r) setLink(r);
            })
          }
        >
          <MessageCircle data-icon="inline-start" aria-hidden />
          {labels.telegramConnect}
        </Button>
      </div>
      {link && (
        <div className="bg-muted/50 flex flex-col gap-1.5 rounded-md border p-3 text-sm" role="status">
          {link.link && (
            <a
              href={link.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-1 font-semibold underline"
            >
              {labels.telegramOpen}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
          <p>
            {labels.telegramCode.split("{code}")[0]}
            <code dir="ltr" className="bg-background rounded px-1.5 py-0.5 font-mono font-bold tracking-wider">
              {link.code}
            </code>
          </p>
          <p className="text-muted-foreground text-xs">{labels.telegramExpires}</p>
        </div>
      )}
    </div>
  );
}
