export const fill = (s: string, params: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ""));
