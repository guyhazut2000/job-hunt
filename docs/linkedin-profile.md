# LinkedIn profile workspace (#116)

Route: `/cv/linkedin` (signed in). Lib: `src/lib/linkedin/profile.ts`, server loaders `src/lib/linkedin/server.ts`,
actions `src/app/cv/linkedin/actions.ts`, UI `src/components/linkedin/LinkedinWorkspace.tsx`.

- **Input is pasted by the user.** The app never fetches LinkedIn pages, never uses a LinkedIn API and never posts.
  The output is text to copy.
- **Checks (16)** run in the browser on every keystroke (`evaluateLinkedin`). They cover headline, About, experience
  lines, Featured links, recommendations and consistency with the CV (`loadCvSource`).
- **Limits**: headline 220 and About 2,600 characters are the commonly reported LinkedIn editor limits. LinkedIn
  Help does not publish them as a rule, so the UI labels them approximate. The ~300-character "see more" fold and
  the 400-character minimum are heuristics. The recommendations goal is the user's own goal (default 3), not a
  LinkedIn rule.
- **Suggestions**: `suggestHeadline` / `suggestAbout` use only the CV's own words. The optional AI rephrase goes
  through `guardedLLM("linkedin_profile")`. `validateLinkedinAi` rejects invalid JSON, anything over the limits,
  any number or tool not in the CV (`introducesFacts`) and clichés. On rejection, the CV-based version stays.
- **Storage**: `LinkedinProfileDraft` (one per user, additive migration `20261104180000_linkedin_manager`).
- Sources (link only): LinkedIn Help a554351, a553140.
