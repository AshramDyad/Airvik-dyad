---
name: supabase-workflow
description: "MANDATORY local-first workflow for ALL database changes in this project. Enforces safe migration creation, local testing, and production deployment. Auto-invoke whenever the user says 'add a column', 'create a table', 'write a migration', 'update the schema', 'add an index', 'create a function', 'fix the RLS policy', 'add a trigger', 'change the database', 'supabase migration', 'supabase db push', 'supabase db reset', 'alter table', 'drop column', 'create enum', 'update permissions', 'add constraint', 'foreign key', 'booking function', 'availability query', 'reservation schema', 'seed data', 'database function', 'stored procedure', 'PL/pgSQL', or any SQL DDL/DML operation. Also activate when the user uploads a .sql file or asks about database schema changes. Do NOT use for: general Postgres optimization advice (use supabase-postgres-best-practices instead), authentication flow questions (use nextjs-supabase-auth instead), or frontend React/Next.js code that does not involve schema changes."
---

# Supabase Database Workflow

This skill enforces a strict local-first workflow for every database change. Follow these steps exactly. No shortcuts. No exceptions.

## Connection Details

| Resource | URL |
|----------|-----|
| **Local DB** | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| **Local Studio** | http://localhost:54323 |
| **Local API** | http://127.0.0.1:54321 |
| **Baseline migration** | `supabase/migrations/00000000000000_baseline.sql` |
| **Seed script** | `scripts/create-clean-seed.sh` |
| **Config** | `supabase/config.toml` |
| **Local env** | `.env.local.dev` |
| **Production env** | `.env.local` |

## Workflow

### Step 1: Create the migration file

```bash
supabase migration new <descriptive_snake_case_name>
```

This creates an empty file at `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`.

Naming conventions:
- `add_<thing>` — new tables, columns, functions, indexes
- `update_<thing>` — modifications to existing objects
- `fix_<thing>` — bug fixes in functions or policies
- `remove_<thing>` — dropping objects
- `create_<thing>_rls_policies` — security policy changes

### Step 2: Write the SQL

Write the migration SQL into the file from Step 1. Follow these rules:

1. Use `CREATE OR REPLACE`, `IF NOT EXISTS`, `IF EXISTS` for idempotency where possible.
2. Wrap complex multi-statement changes in `BEGIN; ... COMMIT;`.
3. Start with `SET search_path TO public;` if targeting the public schema.
4. Always double-quote identifiers to avoid reserved-word collisions.
5. Add a commented-out rollback section at the bottom of the file:
   ```sql
   -- ROLLBACK:
   -- DROP FUNCTION IF EXISTS public.my_function;
   -- ALTER TABLE public.my_table DROP COLUMN IF EXISTS my_column;
   ```

For RLS policies, this project uses a permission-based system:
- Check permission: `user_has_permission(auth.uid(), 'permission_name')`
- Check role: `get_user_role(auth.uid())`
- Role hierarchy: `user_can_manage_role()`, `user_can_manage_user()`
- Roles: Guest, Manager, Owner, Admin (hierarchical via `role_level()`)

Consult the `supabase-postgres-best-practices` skill for indexing strategy, query optimization, and RLS performance patterns.

### Step 3: Test locally

```bash
supabase db reset
```

This drops the local database, runs all migrations (baseline + yours), then seeds. Watch the output for:
- SQL syntax errors
- Constraint violations
- Dependency ordering issues
- Seed conflicts with new schema

**If reset fails:** Fix the SQL in the migration file you created and re-run. Do NOT create a second migration file — the first one has never been applied to production, so editing it is safe and preferred.

### Step 4: Verify the migration

Run verification queries against the LOCAL database:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "<SQL>"
```

Verify as appropriate:
- New tables/columns exist with correct types
- Functions return expected results
- RLS policies allow/deny correctly (test with `SET ROLE`)
- Indexes are created (`\di` or `pg_indexes`)
- Constraints are enforced (try inserting invalid data)

Report all verification results to the user.

### Step 5: STOP — Wait for user approval

**Tell the user: "The migration is ready and tested locally. Please test at http://localhost:54323 (Studio) or http://localhost:3000 (app). When you're satisfied, tell me to push to production."**

Do NOT proceed past this step without explicit user approval.

### Step 6: Pre-deployment backup (MANDATORY before every push)

**Before every `supabase db push`, take backups from production.** This is non-negotiable.

```bash
mkdir -p supabase/backups
```

#### Decide what to backup

Read the migration SQL and determine the backup level:

| Migration contains | Backup needed | Why |
|---|---|---|
| `CREATE OR REPLACE FUNCTION`, `CREATE INDEX`, `ALTER TABLE ADD COLUMN`, `CREATE TABLE`, RLS policies, triggers | **Schema only** | Structure-only changes — schema backup lets us restore old definitions |
| `DELETE`, `TRUNCATE`, `UPDATE` (modifying existing rows), `INSERT ... ON CONFLICT DO UPDATE`, `DROP TABLE`, `DROP COLUMN` | **Schema + Data** | Data could be lost or modified — need both backups to fully restore |
| `INSERT` (new rows only), `CREATE ENUM`, `COMMENT ON` | **Schema only** | Additive-only data changes — no existing data at risk |

#### Schema backup (ALWAYS take this)

```bash
supabase db dump --linked -f supabase/backups/pre-push-$(date +%Y%m%d%H%M%S).sql
```

#### Data backup (ONLY when migration touches existing data)

```bash
supabase db dump --data-only --linked -f supabase/backups/pre-push-data-$(date +%Y%m%d%H%M%S).sql
```

**Take the data backup when the migration contains ANY of these keywords:**
- `DELETE` or `TRUNCATE` — removes rows
- `UPDATE ... SET` — modifies existing rows
- `DROP TABLE` or `DROP COLUMN` — destroys data along with structure
- `ALTER TABLE ... ALTER COLUMN ... TYPE` — type casting can lose data
- Any function that performs DML on existing data (check the function body)

**Skip the data backup when the migration ONLY contains:**
- `CREATE OR REPLACE FUNCTION` — only changes function logic
- `CREATE TABLE` / `ADD COLUMN` — adds new structure, no data affected
- `CREATE INDEX` — performance only
- RLS policy changes — access control only
- `INSERT` into new/empty tables — no existing data at risk

These files are gitignored (`supabase/backups/` is in `.gitignore`).

**Tell the user:** "Pre-deployment backup saved at `supabase/backups/pre-push-TIMESTAMP.sql` [and data backup at `...data-TIMESTAMP.sql`]. If anything breaks, we can restore from this."

### Step 7: Push to production

Only after the user explicitly approves AND the backup is saved:

```bash
supabase db push --dry-run    # Show the user what will be applied
```

Wait for user to confirm the dry-run output looks correct, then:

```bash
supabase db push              # Apply to production
```

### Step 8: Verify production

After pushing, verify the migration worked on production:
- For function changes: query the function via the Supabase RPC or Studio SQL editor
- For schema changes: check the table/column exists via Studio
- For RLS changes: test access with appropriate roles

**Tell the user the verification results.**

## Safety Rules

1. **NEVER run `supabase db push` without explicit user approval.** This is the most important rule.
2. **NEVER modify the baseline migration** (`00000000000000_baseline.sql`). It is a squashed snapshot of production and must not change.
3. **NEVER connect to the production database directly** via psql or any other tool. The only path to production is `supabase db push`.
4. **NEVER run destructive SQL** (`DROP TABLE`, `TRUNCATE`, `DELETE` without `WHERE`) without warning the user and getting explicit confirmation — even locally.
5. **Always use the local connection string** for testing. Never use production credentials.
6. **One migration per logical change.** Do not bundle unrelated changes.
7. **Never edit a migration that has already been pushed to production.** Create a new migration to fix or revert it.

## Anti-Patterns

Do NOT do any of the following:
- Create a migration and push to production in one step (skipping local testing)
- Edit the baseline migration instead of creating a new one
- Run raw SQL against production via psql or the Supabase dashboard
- Create empty migrations or migrations with only comments
- Run `supabase db reset` expecting it to work on production (it is local-only)
- Write migrations that depend on seed data existing
- Skip RLS policy testing (most common source of bugs in this project)
- Bundle multiple unrelated schema changes into a single migration
- Add unsolicited schema changes beyond what the user requested

## Edge Cases

**Docker not running:** If `supabase db reset` fails with a Docker error, tell the user to start Docker Desktop and try again. Do not attempt to start Docker yourself.

**Migration fails on reset:** Read the error message carefully. Common causes:
- Column already exists → use `IF NOT EXISTS`
- Function signature mismatch → use `CREATE OR REPLACE`
- FK constraint violation during seed → check if seed data is compatible with the new schema

**Seed conflicts:** If the clean seed fails after your migration (e.g., you dropped a column that seed data references), tell the user to regenerate the seed: `./scripts/create-clean-seed.sh`

**Multiple pending migrations:** `supabase db push` applies all pending migrations in timestamp order. If you have multiple unpushed migrations, verify they work together with `supabase db reset` before pushing.

## Examples

### Example 1: Adding a column (happy path)

User asks: "Add a notes column to the guests table"

```bash
# Step 1: Create migration
supabase migration new add_notes_to_guests

# Step 2: Write SQL to the created file
```

```sql
-- Add notes column to guests table
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS "notes" text;

-- ROLLBACK:
-- ALTER TABLE public.guests DROP COLUMN IF EXISTS "notes";
```

```bash
# Step 3: Test
supabase db reset

# Step 4: Verify
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'guests' AND column_name = 'notes';"
```

Expected output: `notes | text`

Then STOP and tell the user to test.

### Example 2: Migration fails on reset

```
ERROR: column "status" of relation "reservations" already exists
```

Diagnosis: The column already exists in the baseline. Fix by adding `IF NOT EXISTS`:

```sql
-- Before (fails):
ALTER TABLE public.reservations ADD COLUMN "status" text;

-- After (works):
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "status" text;
```

Re-run `supabase db reset` to confirm the fix.

## Related Skills

- **supabase-postgres-best-practices** — Consult for query optimization, indexing, RLS performance, and schema design. Read its `references/` directory for detailed rules and examples.
- **nextjs-supabase-auth** — Consult when changes affect authentication flow or session handling.

## Project Context

This is an ashram/retreat center booking system. Key domain objects:

| Category | Tables |
|----------|--------|
| **Inventory** | properties, room_types, rooms, room_categories, amenities |
| **Bookings** | reservations, folio_items, booking_restrictions, seasonal_prices, rate_plans |
| **Guests** | guests, profiles |
| **Content** | posts, post_categories, event_banners, testimonials, feedback |
| **Financial** | donations, manual_receipts, tariffs |
| **Access Control** | roles, admin_activity_logs |
| **Import** | import_jobs, import_job_entries (bloat — excluded from seed) |

The baseline migration is 4100+ lines covering all of the above with RLS policies and PL/pgSQL functions.
