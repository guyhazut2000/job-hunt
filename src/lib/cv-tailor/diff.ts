export type DiffPart = { type: "same" | "add" | "del"; text: string };

const MAX_CELLS = 60_000;

/** Word-level diff (LCS) between two strings; whitespace is kept attached to tokens. */
export function wordDiff(a: string, b: string): DiffPart[] {
  if (a === b) return a ? [{ type: "same", text: a }] : [];
  const ta = a.split(/(\s+)/).filter(Boolean);
  const tb = b.split(/(\s+)/).filter(Boolean);
  if (ta.length * tb.length > MAX_CELLS) {
    return [...(a ? [{ type: "del" as const, text: a }] : []), ...(b ? [{ type: "add" as const, text: b }] : [])];
  }
  const n = ta.length;
  const m = tb.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = ta[i] === tb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (ta[i] === tb[j]) {
      push("same", ta[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) push("del", ta[i++]);
    else push("add", tb[j++]);
  }
  while (i < n) push("del", ta[i++]);
  while (j < m) push("add", tb[j++]);
  return out;
}

/** Whether a line was rephrased (ignoring surrounding whitespace). */
export function changed(a: string, b: string): boolean {
  return a.trim() !== b.trim();
}
