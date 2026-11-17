"use server";

import { track } from "@/lib/analytics";
import { addSkillToProfile, loadSkillSuggestions, setDismissed, type SuggestResult } from "@/lib/skill-suggest/server";
import { requireUser } from "@/lib/session";

/**
 * Every action returns the fresh suggestions so the section updates from the result itself;
 * after "add" the client refreshes the page, because the skills editor below must show the new skill.
 */

/** One-click "add to my skills" from a suggestion. */
export async function addSuggestedSkill(name: string): Promise<{ result: string; data: SuggestResult }> {
  const user = await requireUser("/profile");
  const result = await addSkillToProfile(user.id, String(name ?? "").slice(0, 60));
  if (result === "added") track("skill_suggestion_added");
  // No revalidatePath: the client calls router.refresh() so the skills editor re-reads the profile
  // (dynamic pages like /jobs are never served stale from the router cache).
  return { result, data: await loadSkillSuggestions(user.id) };
}

/** Hide a suggestion for good (until "show hidden"). */
export async function dismissSuggestedSkill(key: string): Promise<SuggestResult> {
  const user = await requireUser("/profile");
  const k = String(key ?? "").slice(0, 60);
  if (k) await setDismissed(user.id, k);
  return loadSkillSuggestions(user.id);
}

export async function restoreDismissedSkills(): Promise<SuggestResult> {
  const user = await requireUser("/profile");
  await setDismissed(user.id, null);
  return loadSkillSuggestions(user.id);
}

/** Manual refresh: re-pick the top jobs and re-extract their skills (the AI prompt cache still applies). */
export async function refreshSkillSuggestions(): Promise<SuggestResult> {
  const user = await requireUser("/profile");
  return loadSkillSuggestions(user.id, { force: true });
}

/** The AI reading the page asks for after showing the instant rules preview (uses today's cache). */
export async function loadAiSkillSuggestions(): Promise<SuggestResult> {
  const user = await requireUser("/profile");
  return loadSkillSuggestions(user.id);
}
