# Booking edit: local acceptance

## Release verification — 5 November 2026

Release update: the user approved history reconciliation and publishing only the booking-save fix. Nine verified existing migrations were marked applied using `supabase migration repair`, without rerunning their SQL. Credit notes (`20260604000000`) and the differing Rishiraj role definition (`20260608065346`) remain unmarked and unchanged. An isolated release directory at `/private/tmp/ashram-booking-deploy` excludes those two files; its dry run contains only `20261001123108_add_atomic_booking_edit.sql`. Do not use an ordinary repository-wide push to deploy the excluded changes accidentally. The refund SQL was not executed; only its already-present result was recorded in history.

Retested against a fresh export from production `crdksiypusddfbsgvbhj`, restored into the isolated local stack `ashram-booking-release`. The old seed stack is stopped and its Docker volume preserved. Local configuration is `/private/tmp/ashram-booking-release-20261105/supabase/config.toml`; repository seeds and migrations are disabled there. Only `20261001123108_add_atomic_booking_edit.sql` was applied after restoring production.

- All 75 exported table row counts matched before testing: 16,096 reservations, 9,236 folio items, 11 Auth users. This is a database snapshot, not a complete hosted-project clone; Storage file contents and hosted settings were not copied.
- Private ignored exports: `supabase/backups/booking-release-20261105/`. Schema, data, roles, Auth/Storage schema definitions and production migration history were exported. The production profile-creation trigger and role timeouts were restored locally.
- Local PostgreSQL 17.6.1.121, PostgREST 14.5, Auth 2.197.0 and Storage 1.89.11 match refreshed production CLI metadata. Initial data restore failures rolled back completely; the final restore succeeded using the local administrator for protected Storage metadata.
- `pnpm test`: 257 tests passed; lint and typecheck passed. Build passed with existing Edge-runtime warnings and local-data fetch warnings while the local database was still starting. No rules were disabled.
- Database tests: 38 passed on the restored production snapshot. Four real-connection concurrency scenarios passed. The authenticated HTTP test passed: 37 rooms, 90 guests, room replacement, totals/payment references, persistence, unauthorized access and stale-edit rejection. Local save/read time was 145 ms, not a production benchmark.
- Production dry run includes **12 migrations**, of which 11 are outside this release, including the unrelated refund migration. No production migrations were applied. Do not run an ordinary production push until this discrepancy is resolved separately and the release dry run contains only the intended change.
- Vercel production access must be restored and the current live commit verified before deployment. No commit, push or production deployment was performed during these checks.

For repeat database checks against this isolated stack:

```sh
supabase test db supabase/tests/database/booking_edit.test.sql --workdir /private/tmp/ashram-booking-release-20261105
```

The local app remains at `http://127.0.0.1:3000` using `.env.booking-local`. Local acceptance and the approved release dry run remain required before production deployment.

## Before / after

Before: changing one room could update all 37 rows, trigger overlapping full reloads, and leave the form waiting.

After: the main edit form sends one PATCH. One database transaction updates changed rows, cancels removed rows, creates extras, moves payments when needed and records activity. A failure rolls everything back. The confirmed result is applied immediately; one batched background refresh updates affected bookings and the current list.

The form keeps its original snapshot and unsaved values. Concurrent stale edits are rejected. A missing response ends the wait after 30 seconds, triggers a targeted verification read and never automatically repeats the write or claims rollback.

## Important safety detail

Stale edits use SQLSTATE `PT409`, not `40001`. The real HTTP test reproduced an infinite-retry problem with `40001` in PostgREST 14; the pgTAP-only test could not expose that transport behavior. See [Supabase's official guidance](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).

## Local environment

The stack is at `http://127.0.0.1:54321`, with [Studio](http://localhost:54323).

Both existing environment files point at a hosted project, including `.env.local.dev`. They were not changed. Use the ignored `.env.booking-local` for this acceptance run. Do not run plain `pnpm dev` assuming it uses the local database.

Use the project's supported Node 24 runtime. Clear inherited Supabase variables before loading the local file:

```sh
env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY -u SUPABASE_SERVICE_ROLE_KEY node --env-file=.env.booking-local node_modules/next/dist/bin/next start --hostname 127.0.0.1
```

This serves the already-built local configuration at [the local app](http://localhost:3000). Local auth users are separate from production. Studio can be used to inspect the local database without a production login.

## Repeatable checks

```sh
pnpm test
pnpm lint
pnpm typecheck
# Supply .env.booking-local to the pnpm process when building; do not use production env defaults.
supabase test db
node scripts/test-booking-edit-concurrency.ts
env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY -u SUPABASE_SERVICE_ROLE_KEY node --env-file=.env.booking-local scripts/test-booking-edit-http.ts
```

The concurrency script uses separate real DB connections. The HTTP script requires the local app and creates a temporary local user and a 37-room/90-guest booking with a payment. Both scripts remove only their own UUID-scoped fixtures. pgTAP fixtures roll back. None of these scripts accepts a production database URL.

Check a room replacement, addition/removal, dates, guest counts, notes and custom rates. Refresh afterward and verify room selection, guest totals, saved prices, folios and activity. Confirm a failed/stale save preserves the draft and leaves committed data unchanged.

## Quality baseline and rollout

Final verification on 1 October 2026:

- `pnpm test`: 48 files / 257 tests passed.
- `pnpm lint`: passed with existing warnings; no new warnings in changed files.
- `pnpm typecheck`: passed.
- `pnpm build`: passed using the verified local-only environment and supported Node 24.
- `supabase test db`: 38 checks passed, including forced late-stage rollback.
- Real separate-connection concurrency script: four scenarios passed.
- Real authenticated HTTP script: 37 rooms / 90 guests, payment references, fresh-read persistence, unauthorized rejection and non-retryable stale rejection passed. The final local save/read check took 145 ms; this is not a production timing claim.

The Next.js architectural review led to protection against older background reads and delayed PATCH responses overwriting newer results. The final form test also led to comparing actual draft values while async validation is pending, so background data cannot overwrite unsaved notes.

Before implementation: 202 tests passed; lint had existing warnings; typecheck had four invalid mock-result fields in two existing component tests. Only those invalid `success` fields were removed. No rules or type checks were weakened.

Existing creation, payment attachment, room-segment and check-in/out helper signatures remain unchanged. The 10,000-payment lookup fix remains unchanged. No dependencies, new tables, job system or framework upgrades were added.

Production has not been changed. The mandatory Supabase workflow stops here for local acceptance and explicit production approval. After approval: back up schema and data, review the migration dry run, deploy the database migration first, then deploy the app. The unrelated untracked refund migration must not be silently included or removed; resolve it separately if the dry run includes it.

Local pre-reset backup: `/private/tmp/ashram-booking-backup.GxwAeU/local-before-booking-edit.dump`. Only the approved local test database was reset.
