import { GRAPH, TRACKS, trackOrder, type Graph } from "./graph";
import { ROLE_TRACKS } from "./recommend";

/** Per-step state on a role track: done, being learned, prerequisites met, or still waiting on some. */
export type StepState = "done" | "learning" | "ready" | "locked";

export interface RoadmapStep {
  id: string;
  state: StepState;
  /** 0..100 */
  pct: number;
  /** Prerequisites (anywhere in the graph) the user has not finished yet. */
  missing: string[];
}

export interface TrackRoadmap {
  trackId: string;
  steps: RoadmapStep[];
  done: number;
  total: number;
  /** First not-done step in track order whose prerequisites are met (an in-progress one wins). */
  nextId: string | null;
}

/** Outbound-only links to the matching public roadmap.sh guide. Nothing from it is copied. */
export const TRACK_ROADMAP_SH: Record<string, string | undefined> = {
  frontend: "frontend",
  backend: "backend",
  fullstack: "full-stack",
  devops: "devops",
  data: "data-engineer",
  ml: "machine-learning",
};

export function trackRoadmap(
  trackId: string,
  input: { known: Set<string>; inProgress: Map<string, number> },
  g: Graph = GRAPH,
): TrackRoadmap | null {
  const track = TRACKS.find((t) => t.id === trackId);
  if (!track) return null;
  const steps = trackOrder(track.skills, g).map((id): RoadmapStep => {
    const node = g.byId.get(id)!;
    const missing = node.prerequisites.filter((p) => !input.known.has(p));
    if (input.known.has(id)) return { id, state: "done", pct: 100, missing: [] };
    const p = input.inProgress.get(id);
    if (p !== undefined) return { id, state: "learning", pct: Math.round(Math.min(0.99, p) * 100), missing };
    return { id, state: missing.length ? "locked" : "ready", pct: 0, missing };
  });
  const next =
    steps.find((s) => s.state === "learning" && s.missing.length === 0) ??
    steps.find((s) => s.state === "ready") ??
    steps.find((s) => s.state === "learning") ??
    null;
  const done = steps.filter((s) => s.state === "done").length;
  return { trackId, steps, done, total: steps.length, nextId: next?.id ?? null };
}

/** Tracks for the user's target roles, in role order, de-duplicated; falls back to all tracks. */
export function tracksForRoles(roles: string[]): string[] {
  const out = [...new Set(roles.flatMap((r) => ROLE_TRACKS[r] ?? []))].filter((id) => TRACKS.some((t) => t.id === id));
  return out.length ? out : [];
}

/** The track to show: an explicit valid choice, else the first for the target roles, else full-stack. */
export function pickTrack(requested: string | undefined, roles: string[]): string {
  if (requested && TRACKS.some((t) => t.id === requested)) return requested;
  return tracksForRoles(roles)[0] ?? "fullstack";
}
