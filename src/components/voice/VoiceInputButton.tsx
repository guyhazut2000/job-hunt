"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Square } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fill, voiceStrings } from "@/lib/i18n/voice";
import { otherVoiceLang } from "@/lib/voice/speech";
import { cn } from "@/lib/utils";
import { useSpeechToText, type UseSpeechToTextOptions } from "./useSpeechToText";

export interface VoiceInputButtonProps extends UseSpeechToTextOptions {
  /** UI locale; defaults to <html lang>. */
  locale?: string;
  /** "sm" fits inside inputs (search), "md" matches 44px touch targets. */
  size?: "sm" | "md";
  /** Hide the language chip (language still follows the shared preference). */
  compact?: boolean;
  /** Render nothing at all when the browser can't do speech recognition. */
  hideWhenUnsupported?: boolean;
  className?: string;
  disabled?: boolean;
  testId?: string;
}

const FLASH_MS = 4500;

/**
 * Microphone button that dictates into a text field via the browser's Web Speech API.
 * Interim words appear live in the field; final words are appended. Renders nothing during SSR /
 * before mount, then either the mic (with a Hebrew/English toggle) or a disabled mic with a tooltip
 * explaining why (unsupported browser, insecure origin, blocked permission).
 */
export function VoiceInputButton({
  locale,
  size = "md",
  compact = false,
  hideWhenUnsupported = false,
  className,
  disabled = false,
  testId,
  ...opts
}: VoiceInputButtonProps) {
  const v = useSpeechToText(opts);
  const [uiLocale, setUiLocale] = useState(locale);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!locale) setUiLocale(document.documentElement.lang || "he");
  }, [locale]);
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const s = voiceStrings(uiLocale ?? locale);

  const show = (msg: string) => {
    clearTimeout(flashTimer.current);
    setFlash(msg);
    flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
  };

  // Surface recognition errors in the tooltip.
  useEffect(() => {
    if (v.error && v.error !== "aborted") show(s.errors[v.error]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.error]);

  if (v.support === null) return null;
  if (v.support === "unsupported" && hideWhenUnsupported) return null;

  const blockedReason =
    v.support === "unsupported"
      ? s.unsupported
      : v.support === "insecure"
        ? s.insecure
        : v.denied
          ? s.errors.denied
          : null;
  const unavailable = blockedReason !== null || (disabled && !v.listening);
  const langName = s.langs[v.lang];
  const otherName = s.langs[otherVoiceLang(v.lang)];

  const label = v.listening ? s.stop : fill(s.startLang, { lang: langName });
  const tip = flash ?? blockedReason ?? (v.listening ? fill(s.listeningLang, { lang: langName }) : label);

  const btnSize = size === "sm" ? "size-9" : "size-11";

  return (
    <div className={cn("inline-flex shrink-0 items-center gap-0.5", className)} data-testid={testId}>
      {!compact && !blockedReason && (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/50 grid h-9 min-w-8 place-items-center rounded-md px-1 font-mono text-[0.7rem] font-semibold outline-none focus-visible:ring-3"
          aria-label={fill(s.langToggle, { lang: langName, other: otherName })}
          title={fill(s.langToggle, { lang: langName, other: otherName })}
          onClick={() => v.setLang(otherVoiceLang(v.lang))}
          data-voice-lang={v.lang}
        >
          <span lang={v.lang === "he-IL" ? "he" : "en"}>{s.langShort[v.lang]}</span>
        </button>
      )}
      <Tooltip open={flash ? true : undefined}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={blockedReason ? `${s.start}: ${blockedReason}` : label}
            aria-pressed={v.listening}
            aria-disabled={unavailable || undefined}
            data-state-voice={v.listening ? "listening" : unavailable ? "unavailable" : "idle"}
            className={cn(
              "relative isolate grid shrink-0 place-items-center rounded-full border transition-colors outline-none",
              "focus-visible:ring-ring/50 focus-visible:ring-3",
              btnSize,
              v.listening
                ? "border-destructive/40 bg-destructive text-white"
                : "border-border bg-background text-foreground hover:bg-muted",
              unavailable && "text-muted-foreground hover:bg-background cursor-not-allowed opacity-60",
            )}
            onClick={() => {
              if (blockedReason) return show(blockedReason);
              if (disabled && !v.listening) return;
              v.toggle();
            }}
          >
            {v.listening && (
              <span
                aria-hidden
                className="bg-destructive/35 absolute inset-0 -z-10 rounded-full motion-safe:animate-ping"
              />
            )}
            {v.listening ? (
              <Square className="size-3.5 fill-current" aria-hidden />
            ) : blockedReason ? (
              <MicOff className="size-4" aria-hidden />
            ) : (
              <Mic className="size-4" aria-hidden />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          {tip}
        </TooltipContent>
      </Tooltip>
      <span className="sr-only" aria-live="polite" role="status">
        {v.listening ? s.listening : v.error && v.error !== "aborted" ? s.errors[v.error] : ""}
      </span>
    </div>
  );
}
