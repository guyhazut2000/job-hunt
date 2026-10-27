# Deploying

Production runs on Vercel (project `job-hunt`, region `fra1`). Every push to `master` triggers a
production deployment. Every other branch and PR gets a preview deployment.

## Database migrations run automatically on production deploys

Vercel runs `npm run vercel-build` (set in `vercel.json` → `buildCommand`):

```
prisma generate && node scripts/migrate-on-build.mjs && next build
```

`scripts/migrate-on-build.mjs` decides what to do:

| Build                                   | Action                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `VERCEL_ENV=production`                 | `prisma migrate deploy` using **`DIRECT_URL`**. If `DIRECT_URL` is missing or the migration fails, the build fails. |
| `VERCEL_ENV=preview`                    | **Skipped.** Previews share the production `DATABASE_URL`, so an unmerged branch must never migrate it.             |
| preview + separate `PREVIEW_DIRECT_URL` | Migrates that DB (only if it differs from `DIRECT_URL` and `DATABASE_URL`). Not configured today.                   |
| local / CI (`VERCEL_ENV` unset)         | Skipped. Use `npm run db:deploy` / `npm run db:migrate`.                                                            |
| `SKIP_BUILD_MIGRATIONS=1`               | Skipped (emergency escape hatch).                                                                                   |

A failed migration fails the build, so the deployment never goes live and the previous production
deployment keeps serving. A healthy deploy's build log shows
`[migrate-on-build] Running prisma migrate deploy …` followed by `No pending migrations to apply.`
(or the list of applied migrations).

### Environment variables (Vercel)

- `DATABASE_URL`: the **pooled** Neon URL (`-pooler` host), used at runtime. Production and Preview.
- `DIRECT_URL`: the **direct** (non-pooled) Neon URL, used only for migrations. **Production only.**
  `prisma migrate deploy` takes a Postgres advisory lock, which doesn't work through PgBouncer.

## Writing migrations: keep them additive

Migrations are applied _before_ the new code goes live, while the old deployment is still serving
traffic, and an instant rollback in Vercel does **not** undo them. So every migration must work with
both the old code and the new code:

- OK: new tables, new nullable columns (or columns with a default), new enum values, new indexes and FKs.
- Not in one step: dropping or renaming columns or tables, changing a column's type, `SET NOT NULL`, deleting data.
  Do these as expand → migrate → contract across separate deploys.

CI enforces this:

1. **Drift check.** `prisma migrate diff --from-migrations … --to-schema-datamodel … --exit-code`
   fails if `schema.prisma` changed without a matching migration (run `npx prisma migrate dev --name <change>`).
2. **Additive check** (PRs). `npm run db:check-additive` fails on destructive SQL in newly added
   migrations. To ship an intentional destructive change, add `-- destructive-ok: <reason>` to the
   migration file and call it out in the PR.

## Rollback

Use Vercel's _Instant Rollback_ to the previous production deployment. The schema stays migrated,
which is safe as long as migrations are additive. Never hand-edit `_prisma_migrations` in prod.
