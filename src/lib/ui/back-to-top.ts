/** Scroll distance (px) after which the floating "back to top" button appears. */
export const BACK_TO_TOP_THRESHOLD = 400;

/** The button shows once the user has scrolled past the threshold, and hides again near the top. */
export function shouldShowBackToTop(scrollTop: number, threshold = BACK_TO_TOP_THRESHOLD): boolean {
  return Number.isFinite(scrollTop) && scrollTop > threshold;
}

/** Users who asked the OS for reduced motion get an instant jump instead of a smooth scroll. */
export function backToTopBehavior(prefersReducedMotion: boolean): ScrollBehavior {
  return prefersReducedMotion ? "auto" : "smooth";
}

/** An element is its own scroll container only if it actually overflows and allows scrolling. */
export function isScrollContainer(el: { scrollHeight: number; clientHeight: number }, overflowY: string): boolean {
  return el.scrollHeight > el.clientHeight && /(auto|scroll|overlay)/.test(overflowY);
}
