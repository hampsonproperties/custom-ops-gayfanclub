# Phase 1 Implementation: Installation Guide

This guide walks through installing and running the Phase 1 improvements (Email Deduplication + Dead Letter Queue + Structured Logging).

## Step 1: Install Dependencies

```bash
cd custom-ops
npm install pino pino-pretty
```

## Step 2: Run Database Migrations

Apply the new migrations to add DLQ and improve email deduplication:

```bash
# Method 1: Using Supabase CLI (recommended)
npx supabase db push

# Method 2: Manual via Supabase Dashboard
# Go to SQL Editor and run each migration file in order:
# 1. supabase/migrations/20260219000001_improve_email_deduplication.sql
# 2. supabase/migrations/20260219000002_create_dead_letter_queue.sql
```

### Verify Migrations

Check that the migrations ran successfully:

```sql
-- Check email deduplication indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'communications'
  AND indexname LIKE '%fingerprint%';

-- Check DLQ table exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'dead_letter_queue';

-- Check DLQ health view
SELECT * FROM dlq_health;

-- Check email import health
SELECT * FROM email_import_health;
```

Expected output:
- `idx_communications_fingerprint` index exists
- `dead_letter_queue` table has 23 columns
- Both health views return stats

## Step 3: Clean Up Existing Duplicates

Run the cleanup script to remove existing duplicate emails:

```bash
# Dry run first (see what would be deleted)
npx tsx scripts/cleanup-email-duplicates.ts --dry-run

# Review the output, then run for real
npx tsx scripts/cleanup-email-duplicates.ts
```

Expected output:
```
📧 EMAIL DUPLICATE CLEANUP SCRIPT
====================================
Mode: LIVE (will delete duplicates)

📊 Current Email Stats:
   Total emails: 1,247
   Unique provider_message_ids: 1,189
   Unique internet_message_ids: 1,156
   Missing provider_message_id: 23
   Missing internet_message_id: 58

📋 Checking for provider_message_id duplicates...
   Found 12 duplicate groups

📋 Checking for internet_message_id duplicates...
   Found 5 duplicate groups

📋 Checking for fingerprint duplicates...
   Found 3 duplicate groups

🗑️  Deleting 37 duplicate emails...
   Deleted batch 1 (37 emails)

✅ Successfully deleted 37 duplicate emails

📊 Final Email Stats:
   Total emails: 1,210
   Emails removed: 37
```

## Step 4: Update Environment Variables (Optional)

Add these optional variables to `.env.local`:

```bash
# Logging level (trace, debug, info, warn, error)
LOG_LEVEL=info

# Slack webhook for DLQ alerts (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Sentry DSN for error tracking (optional)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

## Step 5: Test Email Import Deduplication

Test that the new deduplication logic works:

```typescript
// Test script: scripts/test-email-deduplication.ts
import { importEmail } from '@/lib/utils/email-import'

const testMessage = {
  id: 'test_provider_id_123',
  internetMessageId: '<test@example.com>',
  subject: 'Test Email',
  from: {
    emailAddress: {
      address: 'customer@example.com',
      name: 'Test Customer',
    },
  },
  toRecipients: [
    {
      emailAddress: {
        address: 'sales@thegayfanclub.com',
        name: 'Sales',
      },
    },
  ],
  body: {
    content: '<p>Test email body</p>',
    contentType: 'html',
  },
  receivedDateTime: new Date().toISOString(),
  conversationId: 'test_thread_123',
}

// First import - should succeed
const result1 = await importEmail(testMessage)
console.log('First import:', result1.action) // "inserted"

// Second import - should detect duplicate
const result2 = await importEmail(testMessage)
console.log('Second import:', result2.action) // "duplicate"

// Clean up test data
await supabase
  .from('communications')
  .delete()
  .eq('provider_message_id', 'test_provider_id_123')
```

Run the test:

```bash
npx tsx scripts/test-email-deduplication.ts
```

Expected output:
```
[Email Import] Processing message: { providerId: 'test_provider_id_123', ... }
[Email Import] Successfully imported: { communicationId: 'abc-123', ... }
First import: inserted

[Deduplication] Duplicate found via provider_message_id: { ... }
Second import: duplicate
```

## Step 6: Test Dead Letter Queue

Test that the DLQ catches failures:

```typescript
// Test script: scripts/test-dlq.ts
import { addToDLQ, getRetryableItems, resolveDLQItem } from '@/lib/utils/dead-letter-queue'

// Add a test failure
const dlqId = await addToDLQ({
  operationType: 'file_download',
  operationKey: 'test:file:123',
  errorMessage: 'HTTP 404: File not found',
  errorCode: 'HTTP_404',
  operationPayload: {
    url: 'https://example.com/file.png',
    workItemId: 'test-work-item',
    filename: 'test.png',
  },
})

console.log('Added to DLQ:', dlqId)

// Check retryable items
const items = await getRetryableItems(10)
console.log('Retryable items:', items.length)

// Resolve the test item
await resolveDLQItem(dlqId!, 'Test completed')

// Clean up
await supabase
  .from('dead_letter_queue')
  .delete()
  .eq('id', dlqId!)
```

Run the test:

```bash
npx tsx scripts/test-dlq.ts
```

Expected output:
```
[DLQ] Added to Dead Letter Queue: { dlqId: 'xyz-789', ... }
Added to DLQ: xyz-789
Retryable items: 0  (won't be retryable until 5 minutes have passed)
```

## Step 7: Monitor DLQ Health

Check the DLQ dashboard in SQL:

```sql
-- Overall health
SELECT * FROM dlq_health;

-- Pending items waiting for retry
SELECT
  operation_type,
  operation_key,
  error_message,
  retry_count,
  next_retry_at
FROM dead_letter_queue
WHERE status = 'pending'
ORDER BY next_retry_at;

-- Common failure patterns
SELECT * FROM dlq_failure_patterns;

-- Failed items needing attention
SELECT
  id,
  operation_type,
  operation_key,
  error_message,
  retry_count
FROM dead_letter_queue
WHERE status = 'failed'
  AND alerted_at IS NULL
ORDER BY created_at DESC;
```

## Step 8: Verify Email Import Health

Check that email imports are working correctly:

```sql
-- Email import health stats
SELECT * FROM email_import_health;

-- Recent email imports
SELECT
  id,
  from_email,
  subject,
  direction,
  triage_status,
  created_at
FROM communications
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Potential duplicates (should be empty after cleanup)
SELECT * FROM potential_duplicate_emails;
```

## Step 9: Update Existing Code (Optional)

To integrate DLQ into existing error handling, update these files:

### Update Shopify Webhook File Downloads

File: `app/api/webhooks/shopify/route.ts`

See `docs/DLQ_INTEGRATION_EXAMPLE.md` for detailed code examples.

### Update Email Import

File: `lib/utils/email-import.ts`

Already updated! The new deduplication logic is active.

## Step 10: Add Cron Job for DLQ Processing (Optional)

Create `app/api/cron/process-dlq/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getRetryableItems } from '@/lib/utils/dead-letter-queue'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger('dlq-processor')

export async function GET() {
  try {
    const items = await getRetryableItems(10)

    log.info({ count: items.length }, 'Processing DLQ items')

    // TODO: Implement retry logic for each operation type

    return NextResponse.json({ processed: items.length })
  } catch (error) {
    log.error({ error }, 'DLQ processing failed')
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/process-dlq",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

## Verification Checklist

After completing installation, verify:

- [ ] `pino` and `pino-pretty` installed
- [ ] Database migrations applied successfully
- [ ] Duplicate cleanup script ran without errors
- [ ] Email deduplication test passed
- [ ] DLQ test passed
- [ ] `email_import_health` view shows stats
- [ ] `dlq_health` view shows stats
- [ ] No duplicate emails in `potential_duplicate_emails` view
- [ ] Logging works in development (pretty-printed)
- [ ] Logging works in production (JSON format)

## Troubleshooting

### Migration Fails: "constraint already exists"

This means a previous version of the migration ran. Drop the constraints and re-run:

```sql
ALTER TABLE communications DROP CONSTRAINT IF EXISTS uq_communications_provider_message_id;
```

Then re-run the migration.

### Cleanup Script Shows "No duplicates found"

This is good! It means your database is clean. Skip to the next step.

### Test Email Import Fails

Check environment variables:

```bash
echo $NEXT_PUBLIC_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY  # Should be set but not echoed for security
```

### DLQ Not Catching Failures

Ensure you're using `addToDLQ()` in catch blocks. See `docs/DLQ_INTEGRATION_EXAMPLE.md`.

## Next Steps

Once Phase 1 is complete:

- **Week 2**: Add stuck items dashboard and "My Actions Today" widget
- **Week 3**: Implement auto-reminder engine
- **Week 4**: Create quick reply templates
- **Week 5**: Build CRM-style customer profiles
- **Week 6**: Add conversations table for email threading

See `FINAL_IMPLEMENTATION_PLAN.md` for the full roadmap.
