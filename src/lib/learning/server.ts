import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { GRAPH, resolveSkill } from "./graph";

export const DEMAND_TAG = "learning-demand";

/**
 * Open-job demand per skill-graph node: node id -> number of active jobs whose techStack has a
 * label resolving to that node. One grouped query over the label array, cached for an hour.
 */
export const getDemand = unstable_cache(
  async (): Promise<[string, number][]> => {
    const rows = await db.$queryRaw<{ label: string; n: bigint }[]>`
      SELECT t AS label, COUNT(*)::bigint AS n
      FROM "Job", unnest("techStack") AS t
      WHERE "isActive" = true
      GROUP BY t`;
    const out = new Map<string, number>();
    for (const r of rows) {
      const node = resolveSkill(r.label, GRAPH);
      if (node) out.set(node.id, (out.get(node.id) ?? 0) + Number(r.n));
    }
    return [...out];
  },
  ["learning-demand-v1"],
  { revalidate: 3600, tags: [DEMAND_TAG] },
);

export async function demandMap(): Promise<Map<string, number>> {
  try {
    return new Map(await getDemand());
  } catch {
    return new Map(); // demand is decoration; never fail a page on it
  }
}

export async function getProgress(userId: string | undefined) {
  if (!userId) return [];
  return db.skillProgress.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
}
