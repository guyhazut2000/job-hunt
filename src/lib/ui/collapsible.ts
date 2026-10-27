/** Collapsed height (px) of long text blocks such as job descriptions. Keep in sync with CollapsibleText's classes. */
export const COLLAPSE_MAX_MOBILE = 260;
export const COLLAPSE_MAX_DESKTOP = 320;
/** Breakpoint (px) where the desktop max applies (Tailwind `md`). */
export const COLLAPSE_DESKTOP_MIN_WIDTH = 768;

export function collapseLimit(viewportWidth: number): number {
  return viewportWidth >= COLLAPSE_DESKTOP_MIN_WIDTH ? COLLAPSE_MAX_DESKTOP : COLLAPSE_MAX_MOBILE;
}

/** Only offer the toggle when clamping actually hides something (1px slack for sub-pixel rounding). */
export function needsCollapse(contentHeight: number, limit: number): boolean {
  return contentHeight > limit + 1;
}
