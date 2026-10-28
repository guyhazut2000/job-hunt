import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { inlineTokens } from "@/lib/chat/links";

/**
 * The tutor's tiny markdown subset (code, **bold**, lists, paragraphs) plus links to pages
 * inside the app. External URLs are never linkified (see `inlineTokens`). React nodes only, no HTML.
 */
function inline(text: string, key: string, onNavigate?: () => void): ReactNode[] {
  return inlineTokens(text).map((t, i) => {
    const k = `${key}-${i}`;
    if (t.type === "code")
      return (
        <code key={k} dir="ltr" className="bg-background/70 rounded px-1 py-0.5 font-mono text-[0.85em]">
          {t.text}
        </code>
      );
    if (t.type === "bold") return <strong key={k}>{t.text}</strong>;
    if (t.type === "link")
      return (
        <Link
          key={k}
          href={t.href}
          onClick={onNavigate}
          className="text-primary font-semibold [overflow-wrap:anywhere] underline underline-offset-4"
        >
          {t.text}
        </Link>
      );
    return <Fragment key={k}>{t.text}</Fragment>;
  });
}

const BULLET = /^\s*([-*•]|\d+[.)])\s+/;

export function ChatMarkdown({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
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
              className="bg-foreground/[0.04] scroll-thin my-2 overflow-x-auto rounded-lg border p-3 font-mono text-[0.8rem] leading-relaxed"
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
              const list = lines.length > 0 && lines.every((l) => BULLET.test(l));
              if (list) {
                const ordered = /^\s*\d/.test(lines[0]);
                const Tag = ordered ? "ol" : "ul";
                return (
                  <Tag key={pi} className={`my-1.5 flex flex-col gap-1 ps-5 ${ordered ? "list-decimal" : "list-disc"}`}>
                    {lines.map((l, li) => (
                      <li key={li}>{inline(l.replace(BULLET, ""), `${bi}-${pi}-${li}`, onNavigate)}</li>
                    ))}
                  </Tag>
                );
              }
              return (
                <p key={pi} className="my-1.5 first:mt-0 last:mb-0">
                  {lines.map((l, li) => (
                    <Fragment key={li}>
                      {li > 0 && <br />}
                      {inline(l, `${bi}-${pi}-${li}`, onNavigate)}
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
