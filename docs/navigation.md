# ניווט: חמישה מסלולים

Signed-in people move through five hubs. Sibling pages sit in a strip under the header. More is
grouped, not a flat list of every screen.

The source of truth is [`src/lib/nav/config.ts`](../src/lib/nav/config.ts). Header, the mobile bar
and `HubNav` all read it. Labels (Hebrew and English) live in
[`src/lib/i18n/navigation.ts`](../src/lib/i18n/navigation.ts). Matching rules are covered by
[`tests/nav-config.test.ts`](../tests/nav-config.test.ts).

## Primary bar

| Hub       | Hebrew | Where        | Who       |
| --------- | ------ | ------------ | --------- |
| Jobs      | משרות  | `/jobs`      | everyone  |
| Companies | חברות  | `/companies` | everyone  |
| Tracker   | מעקב   | `/dashboard` | signed in |
| Documents | מסמכים | `/profile`   | signed in |
| Prep      | הכנה   | `/learn`     | everyone  |

Guests see Jobs, Companies, Prep and Features (יכולות → `/features`). Login and sign-up stay
buttons, not destinations. Salary is in More → Tools for guests, because they have no Tracker hub.

Desktop shows those destinations plus More. The mobile bottom bar is at most five slots including
More: Jobs, Companies, Tracker, Documents, More. Prep is inside the mobile More sheet so the bar
does not overflow. Guests get Jobs, Companies, Prep, Login, More.

A path inside a hub marks that hub's primary link current (`/cv/ats` lights Documents,
`/learn/gaps` lights Prep, `/closing` lights Tracker).

## Secondary strip

Sticky under the header, one row, horizontal scroll. A sibling wins over its parent:
`/jobs/ranking` does not light the Search tab. Job detail (`/jobs/[id]`) does not show the strip.
Print routes hide it.

| Hub       | Tabs                                                                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Jobs      | `/jobs`, `/jobs?view=map`, `/jobs/ranking`, `/jobs/step-up`                                                                              |
| Companies | `/companies`, `/outreach`, `/referrals`                                                                                                  |
| Tracker   | `/dashboard`, `/closing`, `/salary`                                                                                                      |
| Documents | `/profile`, `/cv/standard`, `/cv`, `/cv/tailor`, `/cv/ats`, `/cv/linkedin`                                                               |
| Prep      | `/learn`, `/learn/me`, `/learn/gaps`, `/learn/system-design`, `/learn/problem-solving`, `/learn/concepts`, `/prep/manager`, `/interview` |

`/profile` already has profile / documents tabs, so the documents strip is not repeated there. It
shows on the CV tools and on deeper profile routes such as review. Salary keeps its own
explore / offers / negotiate tabs under the tracker strip.

Tabs the visitor cannot open (ranking, outreach, interview, and so on) are omitted. A strip with
only one remaining tab is not rendered.

Existing URLs are unchanged.

## More

| Section  | Hebrew  | Links                                                                            |
| -------- | ------- | -------------------------------------------------------------------------------- |
| Prep     | הכנה    | the prep tabs — mobile only, and only when Prep is not already on the bottom bar |
| Progress | התקדמות | `/stats`, `/coach`, `/digest`                                                    |
| Tools    | כלים    | `/chat`, `/features`, and `/salary` for guests                                   |
| Admin    | ניהול   | `/admin`, admins only                                                            |

Language and log out stay actions under חשבון. They are not destinations.

Anything that moved into a hub leaves the flat More list. Signed-in people reach salary from
Tracker, not from More.
