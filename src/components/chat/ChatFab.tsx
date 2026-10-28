"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { chatFabPlacement } from "@/lib/chat/placement";
import { chatStrings } from "@/lib/i18n/chat";
import type { Locale } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

// The panel (useChat, cards, dictionaries) only loads when the sheet first opens.
const ChatPanel = dynamic(() => import("./ChatPanel").then((m) => m.ChatPanel), {
  ssr: false,
  loading: () => <div className="text-muted-foreground p-6 text-sm">…</div>,
});

/**
 * Same offsets as BackToTop (which sits on the inline-end side), mirrored to the inline-start side:
 * - "default": above the mobile bottom nav (<md), bottom corner from md up.
 * - "action-bar": job details also has a fixed action bar below lg.
 */
const PLACEMENT = {
  default:
    "bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+1rem)] md:bottom-[calc(env(safe-area-inset-bottom)+1.5rem)]",
  "action-bar":
    "bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+5.25rem)] md:bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] lg:bottom-[calc(env(safe-area-inset-bottom)+1.5rem)]",
} as const;

export function ChatFab({ locale }: { locale: Locale }) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const placement = chatFabPlacement(pathname);
  if (!placement) return null;
  const s = chatStrings(locale);
  // Open from the side the button sits on (inline-start).
  const side = locale === "he" ? "right" : "left";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={s.open}
        title={s.open}
        data-testid="chat-fab"
        className={cn(
          "bg-primary text-primary-foreground fixed start-4 z-30 inline-flex size-12 items-center justify-center gap-2 rounded-full shadow-lg md:start-6 md:h-12 md:w-auto md:px-4",
          "focus-visible:ring-ring/50 outline-none hover:opacity-90 focus-visible:ring-3",
          PLACEMENT[placement],
          open && "invisible",
        )}
      >
        <Sparkles className="size-5" aria-hidden />
        <span className="hidden text-sm font-semibold md:inline">{s.short}</span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={side}
          showCloseButton={false}
          className="w-full gap-0 overflow-hidden p-0 data-[side=left]:w-full data-[side=right]:w-full data-[side=left]:sm:max-w-md data-[side=right]:sm:max-w-md"
          onOpenAutoFocus={(e) => {
            // Focus the message box rather than the first header button.
            e.preventDefault();
            setTimeout(() => document.getElementById("chat-input-sheet")?.focus(), 50);
          }}
        >
          <SheetTitle className="sr-only">{s.title}</SheetTitle>
          <SheetDescription className="sr-only">{s.readOnly}</SheetDescription>
          <ChatPanel locale={locale} variant="sheet" onNavigate={() => setOpen(false)} onClose={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
