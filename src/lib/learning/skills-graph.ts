import { DATA_SKILLS } from "./graph-data";
import { DEVOPS_SKILLS } from "./graph-devops";
import { FOUNDATION_SKILLS } from "./graph-foundations";
import { LANGUAGE_SKILLS } from "./graph-languages";
import { SPECIALIST_SKILLS } from "./graph-specialist";
import { WEB_SKILLS } from "./graph-web";
import type { SkillNode } from "./types";

/**
 * The learning skill graph. Original content written for this app; external
 * resources are links only. See docs/learning.md before editing.
 */
export const SKILLS: SkillNode[] = [
  ...FOUNDATION_SKILLS,
  ...LANGUAGE_SKILLS,
  ...WEB_SKILLS,
  ...DEVOPS_SKILLS,
  ...DATA_SKILLS,
  ...SPECIALIST_SKILLS,
];
