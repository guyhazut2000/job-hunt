# Salary hub, offer comparison and negotiation prep (#91)

Pages: `/salary` (bands + my numbers + asked salaries), `/salary/offers` (calculator),
`/salary/negotiate` (checklist, scripts, counter-offer draft). All three work signed out; saving needs an account.

## Data rules

- Bands come only from `src/lib/salary/reference.ts` (cited public surveys, each with a URL and
  publish date, shown on the page). No invented numbers. Surveys are center-skewed: for other cities
  the page says there is no reliable city split and asks the user to add what they know.
- "המספרים שלי" (`SalaryDataPoint`) are the user's own observations with a required source label
  and optional month. Private to the user, max 500.
- Asked salary per application: `Application.askedSalaryMonthly` + `salaryNote`, edited from the
  Kanban card (`AskedSalary`), listed on `/salary`.
- Glassdoor / LinkedIn Salary / Levels.fyi are outbound links only, labeled "מקור חיצוני · לא מאומת".
  Nothing is fetched from them.

## Offer calculator (`src/lib/offers/calc.ts`)

Per offer: base, bonus, signing bonus, equity (units × (price − strike) × FX ÷ vesting years, then a
conservative haircut, default 50%), pension (employer/severance/employee %), keren hishtalmut
(employer/employee %, capped at the ceiling unless "on full salary"), car benefit / car savings,
travel, meals, other, remote days, commute minutes and cost.

Outputs: normalized annual total (cash + employer contributions + perks + discounted equity),
first-year total, monthly net cash, net incl. bonus, "net value" (net + employer contributions +
perks − commute cost), annual net estimate (equity assumed taxed at 25%). Highest total / net value
is badged. Saved offers are `JobOffer` rows (JSON `data`, validated by `offerInputSchema` on read and
write, max 20 per user, optional link to an application).

**The net is an estimate, labeled as such, not tax advice.** Simplifications: one employer, no
spouse/children credit points beyond the user-entered total, no section 102 timing, no surtax
edge cases, bonus taxed at the marginal rate of the month.

### Tax parameters (`src/lib/offers/tax.ts`) — review every January

| Parameter                              | 2026 value                                                                                               | Source                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Monthly brackets                       | 10% to 7,010 · 14% to 10,060 · 20% to 19,000 · 31% to 25,100 · 35% to 46,690 · 47% to 60,130 · 50% above | Tax Authority 2026 monthly deductions booklet; Kol Zchut |
| Credit point                           | ₪242/month; default 2.25 points (resident man; women 2.75)                                               | Tax Authority booklet                                    |
| National insurance + health (employee) | 4.27% up to ₪7,703; 12.17% to ₪51,910                                                                    | Bituach Leumi employee rates                             |
| Keren hishtalmut ceiling               | ₪15,712/month salary                                                                                     | Tax Authority booklet                                    |
| Pension credit                         | 35% of employee deposit, up to 7% of ₪9,700                                                              | Tax Authority booklet                                    |

Every source shows its effective date and the date we checked it (2026-11-03) on the page. In
January: update the numbers, `TAX_YEAR`, `effective` and `checked`, and the expectations in
`tests/offers-calc.test.ts`.

## Negotiation prep

Checklist (ticks in localStorage only), five Hebrew scripts with copy buttons, and a template-based
counter-offer draft (`src/lib/offers/counter.ts`, no AI) that can be prefilled from a saved offer or
an application with an asked salary. Reasons and extras have voice input. **Nothing is ever sent**;
the user copies the text and sends it themselves.
