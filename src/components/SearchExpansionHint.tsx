/**
 * "Also showing results for Intel": shown when a search was expanded to the other language
 * (company aliases, glossary) or re-read from the other keyboard layout.
 */
export function SearchExpansionHint({ labels, template }: { labels: string[]; template: string }) {
  if (!labels.length) return null;
  const [before, after = ""] = template.split("{q}");
  return (
    <p className="text-muted-foreground text-sm" data-testid="search-expansion-hint">
      {before}
      {labels.map((l, i) => (
        <span key={l}>
          {i > 0 && ", "}
          <bdi className="text-foreground font-medium">{l}</bdi>
        </span>
      ))}
      {after}
    </p>
  );
}
