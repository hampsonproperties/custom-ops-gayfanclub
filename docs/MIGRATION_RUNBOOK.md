# Database Migration Runbook

**Last Updated:** March 3, 2026

---

## Where Migrations Live

All database schema changes are in one place:

```
custom-ops/supabase/migrations/
```

This directory contains 54 migration files covering the full schema from initial setup through the current state. Migrations are named with timestamps (e.g., `20260127000001_initial_schema.sql`) and run in alphabetical order.

---

## How to Run a New Migration

### Option 1: Supabase CLI (Recommended)

```bash
# From the custom-ops directory:
npx supabase db push --db-url "postgresql://postgres:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
```

This applies any unapplied migrations from `supabase/migrations/` in order.

### Option 2: Supabase Dashboard SQL Editor

1. Go to: https://supabase.com/dashboard/project/uvdaqjxmstbhfcgjlemm/sql/new
2. Paste the migration SQL
3. Click Run
4. Verify success

### Option 3: Parent-Level Helper Script

```bash
# From the project root (Gay Fan Club/):
./run-migration.sh custom-ops/supabase/migrations/YOUR_MIGRATION.sql
```

Requires `DATABASE_URL` in a `.env` file at the project root.

---

## How to Create a New Migration

1. Create a file in `custom-ops/supabase/migrations/` with this naming convention:

```
YYYYMMDDHHMMSS_description.sql
```

Example: `20260303000002_add_invoice_tracking.sql`

2. Write idempotent SQL when possible:
   - Use `IF NOT EXISTS` for CREATE TABLE/INDEX
   - Use `IF EXISTS` for DROP operations
   - Wrap data changes in transactions (BEGIN/COMMIT)

3. Test the migration against a development database before applying to production.

4. Apply using one of the methods above.

---

## Current Schema State

The production database was built from these migrations in order:

- `20260127000001` through `20260127000004`: Initial schema, seed data, RLS policies, production hardening
- `20260128*`: Shopify credentials, approval system
- `20260202*` through `20260204*`: Email subscriptions, batch tracking, email categorization, follow-up cadences, work item flags
- `20260205*`: Batch email schema and templates, webhook fix
- `20260219*`: Email deduplication, dead letter queue, stuck items views, email filters, conversations, reminder engine, quick replies
- `20260220*` through `20260222*`: Email enhancements, lead-focused system, CRM fields
- `20260226*`: Shopify notes sync, multi-order architecture, bidirectional sync
- `20260227*`: Retail accounts, email ownership, proof tracking, batch drip emails, customer notes/contacts, user attribution, sales stage, CRM fields
- `20260303*`: Unique constraint on shopify_order_number/design_fee_order_number
- `add_design_fee_order_fields.sql`: Design fee columns (applied but lacks timestamp prefix)

---

## Known Quirks

1. **One migration file lacks a timestamp prefix:** `add_design_fee_order_fields.sql` is already applied to production but doesn't follow the `YYYYMMDDHHMMSS_` naming convention. Do not rename it — Supabase tracks applied migrations by filename.

2. **Duplicate timestamps:** Several migration files share the same timestamp (e.g., three files at `20260203000001`). This is harmless since Supabase applies them in full alphabetical order (the descriptive suffix breaks ties), but avoid creating more duplicates.

---

## Archived Files

Historical SQL files and scripts have been archived (Sprint 6, March 3 2026):

| Location | Contents | Count |
|----------|----------|-------|
| `docs/archived-sql/` | Root-level one-time data fixes and diagnostic queries | 46 files |
| `docs/archived-sql/migrations-to-run/` | Duplicate migration files (already in supabase/migrations/) | 7 + README |
| `docs/archived-sql/migrations/` | Early schema changes and debug queries (already incorporated) | 14 files |
| `docs/archived-scripts/scripts/` | One-off operational scripts (data fixes, debugging, analysis) | 104 files |

These are preserved in git history and in the archive directories. They should NOT be re-run against the database.
