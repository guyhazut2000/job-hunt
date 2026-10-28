/**
 * Links in assistant text. The model (and offline templates) may only link to pages inside the app;
 * anything else is shown as plain text so a poisoned job/company field can't plant an outbound link.
 */
const INTERNAL = /^\/(?:jobs|companies|learn|profile|tracker|chat|documents|map)(?:[/?#][^\s<>"'`)]*)?$/;

export function isInternalPath(href: string): boolean {
  return INTERNAL.test(href) && !href.startsWith("//") && !/[\\]/.test(href);
}

export type InlineToken =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string };

const TOKEN =
  /(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]{1,120}\]\([^)\s]{1,300}\)|(?<![\w/.:])\/(?:jobs|companies|learn|profile|tracker)(?:\/[\w\-%.]+)*(?:\?[\w\-%=&.,]+)?)/g;

/** Splits one line into text / code / bold / link tokens. Non-internal markdown links keep only their label. */
export function inlineTokens(line: string): InlineToken[] {
  const out: InlineToken[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ type: "text", text: line.slice(last, at) });
    const tok = m[0];
    if (tok.startsWith("`")) out.push({ type: "code", text: tok.slice(1, -1) });
    else if (tok.startsWith("**")) out.push({ type: "bold", text: tok.slice(2, -2) });
    else if (tok.startsWith("[")) {
      const [, label, href] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)!;
      out.push(isInternalPath(href) ? { type: "link", text: label, href } : { type: "text", text: label });
    } else {
      // Bare path; drop trailing sentence punctuation from the link.
      const href = tok.replace(/[.,]+$/, "");
      if (isInternalPath(href)) {
        out.push({ type: "link", text: href, href });
        if (href.length < tok.length) out.push({ type: "text", text: tok.slice(href.length) });
      } else out.push({ type: "text", text: tok });
    }
    last = at + tok.length;
  }
  if (last < line.length) out.push({ type: "text", text: line.slice(last) });
  // Merge adjacent text tokens.
  return out.reduce<InlineToken[]>((acc, t) => {
    const prev = acc[acc.length - 1];
    if (t.type === "text" && prev?.type === "text") prev.text += t.text;
    else acc.push({ ...t });
    return acc;
  }, []);
}
