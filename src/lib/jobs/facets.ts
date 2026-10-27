/**
 * Split stored locations ("Herzliya / Tel Aviv", "Tel Aviv, Israel") into cities with job counts,
 * most common first. A job listing two cities counts once for each. Bare country names are dropped.
 */
export function splitLocations(locations: string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const loc of locations) {
    const cities = new Set(
      loc
        .split(/\s*[/|;]\s*/)
        .map((c) => c.split(",")[0]!.trim())
        .filter((c) => c && !/^(israel|ישראל|remote|anywhere)$/i.test(c)),
    );
    for (const c of cities) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
