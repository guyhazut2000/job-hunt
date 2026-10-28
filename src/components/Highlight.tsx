import { highlightSegments } from "@/lib/search/query";

/** Renders `text` with search-term hits wrapped in <mark>. Safe for server and client components. */
export function Highlight({ text, terms }: { text: string; terms?: string[] }) {
  if (!terms?.length) return <>{text}</>;
  return (
    <>
      {highlightSegments(text, terms).map((s, i) =>
        s.hit ? (
          <mark key={i} className="bg-primary/15 text-foreground rounded-[2px] [box-decoration-break:clone] px-px">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}
