import { ExternalLink } from "lucide-react";
import { sdSource } from "@/lib/sysdesign/content";

/** Outbound source links (titles stay as published). */
export function SdSources({ ids, label, className }: { ids: string[]; label: string; className?: string }) {
  const list = ids.map(sdSource).filter((s) => !!s);
  if (!list.length) return null;
  return (
    <p className={className ?? "text-muted-foreground text-xs"}>
      <span className="font-semibold">{label}: </span>
      {list.map((s, i) => (
        <span key={s.id}>
          {i ? " · " : ""}
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 underline"
          >
            <bdi>{s.title}</bdi>
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </span>
      ))}
    </p>
  );
}
