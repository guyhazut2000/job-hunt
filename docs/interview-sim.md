# Interview simulation (`/interview`)

A practice interview in a chat, built from a job or an application the user owns, the company's
hiring process (`src/lib/hiring`) and the user's concepts (`/learn/concepts`). Text or microphone
(`VoiceInputButton`), Hebrew or English.

## Entry points

- Job page → "Practice interview" (`/interview?job=<jobId>`, `JobPrepLinks`).
- Kanban card → "Practice interview" (`/interview?app=<applicationId>`).
- `/learn` → "Interview simulation" card (`/interview`, pick a target there).
- Interview reminder a day before → `/interview?app=<id>` (the ~2h reminder still opens the job page).

## Modes

| Mode      | Questions                                                                 | Follow-ups (no AI)                                                         | Rubric (1–5)                                    |
| --------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| `HR`      | 5: intro, why this company/role, 3 STAR stories                           | Asks for the missing STAR part (result → action → situation → task), max 2 | structure, impact, ownership, clarity           |
| `TECH`    | 5: company concepts first, then the posting's tech stack, + system design | The planned follow-up (trade-offs / debugging), max 1                      | depth, trade-offs, examples, clarity            |
| `PROBLEM` | 3 of our own problems (`src/lib/algo/problems.ts`), easy → medium → hard  | Complexity, then edge cases — skipped if the answer already covers them    | approach, complexity, edge cases, communication |

One question at a time. A very short first answer gets "tell me more". The problem-solving mode has no
code editor: the candidate explains the approach in words, like the first part of a live coding round.
It links to `/learn/problem-solving` for the method.

## AI budget: at most 2 calls per session

1. **Plan** (`interview_plan`, HR/TECH only): one guarded Gemini call returns the questions, their
   follow-ups, focus and expected keywords. A `variant N` line makes a repeat session get new
   questions rather than the cached plan. PROBLEM mode never calls AI for the plan.
2. **Feedback** (`interview_feedback`): one batched call at the end grades the whole transcript
   against the rubric, with per-question notes and up to 5 improvements.

Follow-ups are rule-based (`src/lib/interview/flow.ts`), so answering costs no AI calls. When AI is off,
over the daily cap or fails, the offline bank (`bank.ts`, `plan.ts`) and heuristic grader (`grade.ts`)
are used, and the page labels the source ("offline" / "limit reached"). The remaining calls for today
are shown on the page.

## Data

`InterviewSession` (mode, language, plan JSON, current question, status, feedback JSON, score 0–100,
links to the job / application, `SetNull` on delete) and `InterviewMessage` (role, kind, content,
question index). Migration `20261030160000_interview_sim` is additive. History is listed on
`/interview`; a finished session shows the feedback and the full transcript. Answers that look like a
secret (API key, password) are refused before they are saved.

## Tests

`tests/interview-sim.test.ts`: offline plans per mode, STAR detection, the follow-up flow (no repeats,
caps, skips covered follow-ups), heuristic and AI feedback normalisation, the AI plan with the provider
mocked (AI / mock / PROBLEM / daily limit), and the reminder link.
