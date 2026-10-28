/** Where the floating chat button goes on a route, or null to hide it there. */
export function chatFabPlacement(pathname: string): "default" | "action-bar" | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (/^\/(chat|login|register|admin)(\/|$)/.test(path)) return null;
  // Job details has a fixed mobile action bar (lg:hidden): float above it, like BackToTop.
  if (/^\/jobs\/[^/]+$/.test(path)) return "action-bar";
  return "default";
}
