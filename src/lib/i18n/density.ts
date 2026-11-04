import type { Locale } from "./dictionaries";

/** Strings for long-list controls (show more, load more, filters, density) — docs/ui-data-density.md. */
const en = {
  showMore: "Show {n} more",
  showLess: "Show less",
  showing: "Showing {shown} of {total}",
  loadMore: "Load more",
  filter: "Filter",
  filterCards: "Filter by role or company",
  noMatch: "Nothing matches the filter.",
  density: "View",
  comfortable: "Detailed",
  compact: "Compact",
  details: "Details & actions",
  viewAll: "See all {n}",
};

export type DensityStrings = typeof en;

const he: DensityStrings = {
  showMore: "הצג עוד {n}",
  showLess: "הצג פחות",
  showing: "מוצגים {shown} מתוך {total}",
  loadMore: "טען עוד",
  filter: "סינון",
  filterCards: "סינון לפי תפקיד או חברה",
  noMatch: "אין תוצאות לסינון.",
  density: "תצוגה",
  comfortable: "מפורטת",
  compact: "צפופה",
  details: "פרטים ופעולות",
  viewAll: "לכל ה-{n}",
};

export function densityStrings(locale: Locale | string): DensityStrings {
  return locale === "he" ? he : en;
}

export function fillD(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
