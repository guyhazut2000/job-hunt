# Hiring-manager round and offer reply (#119)

## /prep/manager
Lib `src/lib/manager/bank.ts`, actions `src/app/prep/manager/actions.ts`, card `src/components/manager/ManagerAnswerCard.tsx`.

- **14 behavioral questions** with what each probes, the seniority signals to show, a level (all / senior / staff)
  and a source. Sources: MIT CAPD STAR, Amazon Leadership Principles, Google re:Work structured interviewing,
  StaffEng archetypes and the Tech Interview Handbook. No question is presented as "asked at" a specific company.
- **STAR builder**: saved per question in `ManagerAnswer`. `checkSignals` is a lexical EN/HE hint, not a grade.
  The template answer (`starTemplate`) uses only the user's text. The optional polish uses
  `guardedLLM("manager_answer")` and the shared `validatePolish` fact guard (via `starAsStory`). Editing the notes
  clears an old polished answer.
- **Questions to ask the manager** are quoted from the TIH final-questions list.
- Linked from `/interview`, `/prep/[id]` and the header "More" menu, and links to the work stories.

## Offer reply email (`/closing/[offerId]#reply`)
Lib `src/lib/closing/reply.ts`, UI `src/components/closing/OfferReply.tsx`.

- Accept or counter (up to 4 asks: topic, target, the user's own reason). Figures come only from the saved offer
  (`offerTermLines` lists non-zero entered terms); anything missing stays a placeholder.
- Both modes ask for the final terms in writing, listing the items in section 2 of the Notice to Employee (Terms of
  Employment) Law, 2002, per Kol Zchut's summary.
- Copy only: nothing is sent.
