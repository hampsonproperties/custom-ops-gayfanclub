# Dead Letter Queue Integration Example

This document shows how to integrate the Dead Letter Queue (DLQ) into existing code to eliminate silent failures.

## Problem: Silent File Download Failures

**File:** `app/api/webhooks/shopify/route.ts:139-194`

**Current Behavior:**
```typescript
async function downloadAndStoreFile(...): Promise<{ path: string; sizeBytes: number } | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`Failed to download file: ${response.status} ${response.statusText}`)
      return null  // ❌ Silent failure - error logged but order continues
    }

    // ... upload logic ...

    if (uploadError) {
      console.error(`Failed to upload file to Supabase Storage:`, uploadError)
      return null  // ❌ Silent failure - no alert, no retry
    }

    return { path: storagePath, sizeBytes }
  } catch (error) {
    console.error(`Error downloading/storing file:`, error)
    return null  // ❌ Silent failure - exception swallowed
  }
}
```

**Impact:**
- Orders created with missing design files
- Operators don't know files are missing until they try to download
- No automatic retry when Customify server is temporarily down
- Files lost permanently if download fails

## Solution: Add DLQ Integration

### Step 1: Import DLQ Utility

```typescript
import { addToDLQ } from '@/lib/utils/dead-letter-queue'
```

### Step 2: Update Function to Add DLQ on Failure

```typescript
async function downloadAndStoreFile(
  supabase: any,
  externalUrl: string,
  workItemId: string,
  filename: string
): Promise<{ path: string; sizeBytes: number } | null> {
  try {
    // Ensure URL has protocol
    let url = externalUrl
    if (url.startsWith('//')) {
      url = `https:${url}`
    }

    console.log(`Downloading file from: ${url}`)

    // Download file from external URL
    const response = await fetch(url)
    if (!response.ok) {
      const errorMessage = `HTTP ${response.status}: ${response.statusText}`
      console.error(`Failed to download file: ${errorMessage}`)

      // ✅ Add to DLQ instead of silent failure
      await addToDLQ({
        operationType: 'file_download',
        operationKey: `file:${workItemId}:${filename}`,
        errorMessage,
        errorCode: `HTTP_${response.status}`,
        operationPayload: {
          url,
          workItemId,
          filename,
          httpStatus: response.status,
        },
        workItemId,
      })

      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const sizeBytes = buffer.length

    // Determine file extension
    let extension = 'png'
    const urlExtension = url.split('.').pop()?.toLowerCase()
    if (urlExtension && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf'].includes(urlExtension)) {
      extension = urlExtension
    }

    const storagePath = `work-items/${workItemId}/${filename}.${extension}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('custom-ops-files')
      .upload(storagePath, buffer, {
        contentType: response.headers.get('content-type') || 'image/png',
        upsert: true,
      })

    if (uploadError) {
      console.error(`Failed to upload file to Supabase Storage:`, uploadError)

      // ✅ Add to DLQ for retry
      await addToDLQ({
        operationType: 'file_upload',
        operationKey: `file:${workItemId}:${filename}`,
        errorMessage: uploadError.message,
        errorCode: uploadError.code,
        operationPayload: {
          url,
          workItemId,
          filename,
          storagePath,
          sizeBytes,
        },
        workItemId,
      })

      return null
    }

    console.log(`Successfully stored file at: ${storagePath} (${sizeBytes} bytes)`)
    return { path: storagePath, sizeBytes }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined

    console.error(`Error downloading/storing file:`, error)

    // ✅ Add to DLQ with full error details
    await addToDLQ({
      operationType: 'file_download',
      operationKey: `file:${workItemId}:${filename}`,
      errorMessage,
      errorStack,
      operationPayload: {
        url: externalUrl,
        workItemId,
        filename,
      },
      workItemId,
    })

    return null
  }
}
```

## Benefits

### Before DLQ:
- ❌ File download fails
- ❌ Error logged to console
- ❌ Order continues with external URL fallback
- ❌ No alert to operators
- ❌ No retry
- ❌ File lost forever

### After DLQ:
- ✅ File download fails
- ✅ Error added to Dead Letter Queue
- ✅ Automatic retry in 5 minutes
- ✅ Exponential backoff (5min → 15min → 45min → 2h → 6h)
- ✅ Slack alert after 5 failed retries
- ✅ Dashboard shows stuck items
- ✅ Operators can manually retry from UI

## DLQ Retry Schedule

| Attempt | Wait Time | Total Elapsed |
|---------|-----------|---------------|
| 1st retry | +5 min | 5 min |
| 2nd retry | +15 min | 20 min |
| 3rd retry | +45 min | 1h 5min |
| 4th retry | +2h 15min | 3h 20min |
| 5th retry | +6h 45min | 10h 5min |
| Max reached | Alert sent | - |

## Other Integration Points

### Email Import Failures

```typescript
// In lib/utils/email-import.ts
try {
  const { data: customer } = await supabase
    .from('customers')
    .upsert(customerData)
    .select()
    .single()

  if (insertError) {
    await addToDLQ({
      operationType: 'email_import',
      operationKey: `email:${message.id}`,
      errorMessage: insertError.message,
      operationPayload: { message },
    })
  }
} catch (error) {
  // DLQ handling...
}
```

### Follow-Up Calculation Failures

```typescript
// In app/api/webhooks/shopify/route.ts:641-653
try {
  const { data: nextFollowUp } = await supabase
    .rpc('calculate_next_follow_up', { work_item_id: newWorkItem.id })

  if (nextFollowUp !== undefined) {
    await supabase
      .from('work_items')
      .update({ next_follow_up_at: nextFollowUp })
      .eq('id', newWorkItem.id)
  }
} catch (followUpError) {
  // ✅ Instead of just console.error:
  await addToDLQ({
    operationType: 'follow_up_calculation',
    operationKey: `follow_up:${newWorkItem.id}`,
    errorMessage: followUpError.message,
    errorStack: followUpError.stack,
    operationPayload: { workItemId: newWorkItem.id },
    workItemId: newWorkItem.id,
  })
}
```

### Shopify API Call Failures

```typescript
try {
  const response = await fetch(shopifyApiUrl, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': accessToken },
    body: JSON.stringify(draftOrder),
  })

  if (!response.ok) {
    await addToDLQ({
      operationType: 'shopify_api_call',
      operationKey: `shopify:draft_order:${workItemId}`,
      errorMessage: `HTTP ${response.status}: ${await response.text()}`,
      errorCode: `HTTP_${response.status}`,
      operationPayload: { draftOrder },
      workItemId,
    })
  }
} catch (error) {
  // DLQ handling...
}
```

## Monitoring DLQ Health

### Check DLQ Dashboard

```typescript
import { getDLQHealth, getFailurePatterns } from '@/lib/utils/dead-letter-queue'

const health = await getDLQHealth()
console.log(`Pending retries: ${health.pending_count}`)
console.log(`Failed (needs alert): ${health.needs_alert_count}`)

const patterns = await getFailurePatterns(10)
console.log('Top 10 failure patterns:', patterns)
```

### SQL Query for Stuck Items

```sql
SELECT
  operation_type,
  operation_key,
  error_message,
  retry_count,
  next_retry_at,
  work_item_id
FROM dead_letter_queue
WHERE status = 'failed'
  AND alerted_at IS NULL
ORDER BY created_at DESC;
```

## Cron Job for Retry Processing

Create `app/api/cron/process-dlq/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getRetryableItems, resolveDLQItem } from '@/lib/utils/dead-letter-queue'
import { downloadAndStoreFile } from '@/lib/utils/file-operations'

export async function GET() {
  const items = await getRetryableItems(10)

  for (const item of items) {
    try {
      if (item.operation_type === 'file_download') {
        const { url, workItemId, filename } = item.operation_payload
        const result = await downloadAndStoreFile(supabase, url, workItemId, filename)

        if (result) {
          await resolveDLQItem(item.id, 'File successfully downloaded on retry')
        }
      }
      // Handle other operation types...
    } catch (error) {
      console.error(`DLQ retry failed for ${item.id}:`, error)
      // Will be retried again later
    }
  }

  return NextResponse.json({ processed: items.length })
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

## Summary

The Dead Letter Queue transforms silent failures into:
1. **Automatic retries** with exponential backoff
2. **Operator visibility** via dashboard
3. **Slack alerts** when retries exhausted
4. **Failure pattern analysis** for bug prioritization
5. **Manual retry** capability from UI

No more lost files, stuck items, or silent errors!
