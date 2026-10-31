# Contributing

- Branch from `master`, open a PR, and wait for CI (lint, format, typecheck, tests, migrations, build).
- Migrations must be additive (`npm run db:check-additive`); previews share the production database.
- UI is Hebrew-first (RTL) with English support; use the shadcn components in `src/components/ui`.
- **Every user-facing change updates the feature registry** — [`src/features/registry.ts`](src/features/registry.ts),
  which renders `/features` ("מה המערכת יודעת לעשות"). New pages fail CI until they are listed. See
  [docs/features.md](docs/features.md).
- PRs say `Closes #N` when they fully implement an issue and `Refs #N` when they implement part of it.
- **How we work** (Hebrew): a step-by-step development checklist — success criteria, small PRs, worktrees, additive
  migrations, tests and guards, mobile/desktop verification, green CI → merge → verify prod, one-at-a-time upgrades —
  in [docs/dev-workflow-checklist.md](docs/dev-workflow-checklist.md), and a worked example applying every step to the
  application-delete undo (#74) in [docs/dev-workflow-example.md](docs/dev-workflow-example.md).
