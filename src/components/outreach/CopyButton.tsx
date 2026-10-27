"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers/contexts without the async clipboard API.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function CopyButton({
  text,
  label,
  copiedLabel,
  variant = "secondary",
  size = "sm",
  iconOnly = false,
}: {
  text: string;
  label: string;
  copiedLabel: string;
  variant?: "secondary" | "outline" | "ghost" | "default";
  size?: "sm" | "default" | "icon";
  iconOnly?: boolean;
}) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(false), 1800);
    return () => clearTimeout(id);
  }, [done]);
  const Icon = done ? Check : Copy;
  return (
    <Button
      type="button"
      variant={variant}
      size={iconOnly ? "icon" : size}
      aria-label={iconOnly ? (done ? copiedLabel : label) : undefined}
      onClick={async () => setDone(await copyText(text))}
    >
      <Icon data-icon="inline-start" aria-hidden />
      {!iconOnly && <span aria-live="polite">{done ? copiedLabel : label}</span>}
    </Button>
  );
}
