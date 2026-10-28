import { Fragment, type ReactNode } from "react";

/**
 * A deliberately tiny, safe markdown subset for tutor replies: fenced code blocks, inline code,
 * **bold**, bullet / numbered lines and paragraphs. Builds React nodes (no HTML injection).
 */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`\n]+`|\*\*[^*\n]+\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    out.push(
      tok.startsWith("`") ? (
        <code key={`${key}-${i++}`} dir="ltr" className="bg-secondary rounded px-1 py-0.5 font-mono text-[0.85em]">
          {tok.slice(1, -1)}
        </code>
      ) : (
        <strong key={`${key}-${i++}`}>{tok.slice(2, -2)}</strong>
      ),
    );
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function MiniMarkdown({ text }: { text: string }) {
  const blocks = text.split(/```/);
  return (
    <>
      {blocks.map((block, bi) => {
        if (bi % 2 === 1) {
          const code = block.replace(/^[\w+-]*\n/, "").replace(/\n$/, "");
          return (
            <pre
              key={bi}
              dir="ltr"
              className="bg-foreground/[0.04] my-2 overflow-x-auto rounded-lg border p-3 font-mono text-[0.8rem] leading-relaxed"
            >
              <code>{code}</code>
            </pre>
          );
        }
        const paras = block.split(/\n{2,}/).filter((p) => p.trim());
        return (
          <Fragment key={bi}>
            {paras.map((p, pi) => {
              const lines = p.split("\n").filter((l) => l.trim());
              const list = lines.length > 0 && lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l));
              if (list) {
                const ordered = /^\s*\d/.test(lines[0]);
                const Tag = ordered ? "ol" : "ul";
                return (
                  <Tag key={pi} className={`my-1.5 flex flex-col gap-1 ps-5 ${ordered ? "list-decimal" : "list-disc"}`}>
                    {lines.map((l, li) => (
                      <li key={li}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""), `${bi}-${pi}-${li}`)}</li>
                    ))}
                  </Tag>
                );
              }
              return (
                <p key={pi} className="my-1.5 first:mt-0 last:mb-0">
                  {lines.map((l, li) => (
                    <Fragment key={li}>
                      {li > 0 && <br />}
                      {inline(l, `${bi}-${pi}-${li}`)}
                    </Fragment>
                  ))}
                </p>
              );
            })}
          </Fragment>
        );
      })}
    </>
  );
}
