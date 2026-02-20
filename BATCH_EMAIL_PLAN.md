# Batch Email Notification System - Implementation Plan

## Overview
Implement automated email notifications for customers when their custom orders progress through manufacturing batches. The system will send 4 emails at key milestones, with built-in safeguards to prevent accidental sends and ensure each email is only sent once.

## Email Timeline

### Email 1: Entering Production (Day 1)
**Trigger:** 1 day after batch status changes to 'confirmed'
**Subject:** Your custom fan is officially in production ⚡

### Email 2: Midway Check-In (Day 10)
**Trigger:** ~10 days after batch status changes to 'confirmed'
**Subject:** Quick custom update — everything's on track ✅

### Email 3: Completed + En Route
**Trigger:** When tracking_number is added to batch
**Subject:** Your custom fan is finished and on the move ✈️

### Email 4: Arrived Stateside
**Trigger:** When batch gets new status 'received_at_warehouse'
**Subject:** Arrived in the U.S. — shipping soon 📦

---

## Architecture Design

### 1. Database Schema Changes

#### New Table: `batch_email_queue`
Stores pending email sends with verification delay mechanism.

```sql
CREATE TABLE batch_email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL CHECK (email_type IN ('entering_production', 'midway_checkin', 'en_route', 'arrived_stateside')),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  scheduled_send_at TIMESTAMPTZ NOT NULL,

  -- Verification fields
  expected_batch_status TEXT,
  expected_has_tracking BOOLEAN,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  -- Deduplication
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate queuing
  UNIQUE(batch_id, work_item_id, email_type)
);

CREATE INDEX idx_batch_email_queue_scheduled ON batch_email_queue(scheduled_send_at)
  WHERE status = 'pending';
CREATE INDEX idx_batch_email_queue_batch ON batch_email_queue(batch_id);
CREATE INDEX idx_batch_email_queue_work_item ON batch_email_queue(work_item_id);
```

#### New Table: `batch_email_sends`
Tracks completed email sends for deduplication and audit trail.

```sql
CREATE TABLE batch_email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL CHECK (email_type IN ('entering_production', 'midway_checkin', 'en_route', 'arrived_stateside')),
  recipient_email TEXT NOT NULL,

  communication_id UUID REFERENCES communications(id),

  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  template_key TEXT NOT NULL,

  -- Prevent duplicate sends
  UNIQUE(batch_id, work_item_id, email_type)
);

CREATE INDEX idx_batch_email_sends_batch ON batch_email_sends(batch_id);
CREATE INDEX idx_batch_email_sends_work_item ON batch_email_sends(work_item_id);
```

#### Update Batches Table
Add new status for warehouse receipt tracking.

```sql
ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS received_at_warehouse_at TIMESTAMPTZ;

-- Update status constraint to include new status
-- (Current status values: 'draft', 'confirmed', 'exported')
-- We'll add 'received_at_warehouse' status
```

---

### 2. Email Templates

Create 4 new email templates in the `email_templates` table using the existing template system.

#### Template Keys:
- `batch-entering-production`
- `batch-midway-checkin`
- `batch-en-route`
- `batch-arrived-stateside`

#### Merge Fields:
```
{{first_name}}
{{customer_name}}
{{order_number}}
{{batch_name}}
{{shop_url}}  // e.g., "https://thegayfanclub.com"
{{discount_code}}  // "WAIT20"
```

#### Template HTML Structure:
Each template will include:
- Personalized greeting with `{{first_name}}`
- Status-specific messaging
- Promotional section with WAIT20 discount code
- Links to shop sections (Fan Favorites, Clearance)
- Signature from "The Gay Fan Club Team"

---

### 3. Delayed Send Mechanism

**Safety Delay: 5 minutes**

When a trigger event occurs (status change, tracking number added):
1. Email is queued in `batch_email_queue` with `scheduled_send_at = NOW() + 5 minutes`
2. Verification conditions stored (expected status, tracking presence, etc.)
3. Status set to 'pending'

**Before Sending (Verification Step):**
1. Check if conditions still match:
   - Batch status hasn't changed back
   - Tracking number still present (if required)
   - Work item still in batch
2. If conditions changed → cancel the email, log reason
3. If conditions match → send email, mark as sent

---

### 4. Trigger Detection Logic

#### Email 1: Entering Production (Day 1 after confirmation)
**Trigger Point:** When batch status changes from 'draft' → 'confirmed'

```typescript
// In useConfirmBatch hook or batch confirmation API
async function onBatchConfirmed(batchId: string) {
  // Get all work items in batch
  const workItems = await getWorkItemsInBatch(batchId);

  // Queue Email 1 for each work item (send 1 day later)
  for (const item of workItems) {
    await queueBatchEmail({
      batchId,
      workItemId: item.id,
      emailType: 'entering_production',
      recipientEmail: item.customer_email,
      recipientName: item.customer_name,
      scheduledSendAt: addDays(new Date(), 1),
      expectedBatchStatus: 'confirmed'
    });
  }

  // Queue Email 2 for each work item (send 10 days later)
  for (const item of workItems) {
    await queueBatchEmail({
      batchId,
      workItemId: item.id,
      emailType: 'midway_checkin',
      recipientEmail: item.customer_email,
      recipientName: item.customer_name,
      scheduledSendAt: addDays(new Date(), 10),
      expectedBatchStatus: 'confirmed'
    });
  }
}
```

#### Email 3: En Route (when tracking added)
**Trigger Point:** When `tracking_number` is updated on batch

```typescript
// In useUpdateBatchTracking hook or tracking update API
async function onTrackingNumberAdded(batchId: string, trackingNumber: string) {
  const workItems = await getWorkItemsInBatch(batchId);

  for (const item of workItems) {
    await queueBatchEmail({
      batchId,
      workItemId: item.id,
      emailType: 'en_route',
      recipientEmail: item.customer_email,
      recipientName: item.customer_name,
      scheduledSendAt: addMinutes(new Date(), 5), // 5 min delay
      expectedHasTracking: true
    });
  }
}
```

#### Email 4: Arrived Stateside (warehouse receipt)
**Trigger Point:** When batch status changes to 'received_at_warehouse'

```typescript
// New mutation: useMarkBatchReceivedAtWarehouse
async function onBatchReceivedAtWarehouse(batchId: string) {
  const workItems = await getWorkItemsInBatch(batchId);

  for (const item of workItems) {
    await queueBatchEmail({
      batchId,
      workItemId: item.id,
      emailType: 'arrived_stateside',
      recipientEmail: item.customer_email,
      recipientName: item.customer_name,
      scheduledSendAt: addMinutes(new Date(), 5), // 5 min delay
      expectedBatchStatus: 'received_at_warehouse'
    });
  }
}
```

---

### 5. Email Queue Processing System

#### New Cron Endpoint: `/api/cron/process-batch-emails`

**Runs every minute**

```typescript
// Pseudo-code
async function processBatchEmails() {
  // Find emails ready to send (scheduled_send_at <= NOW, status = 'pending')
  const pendingEmails = await supabase
    .from('batch_email_queue')
    .select('*, batch:batches(*), work_item:work_items(*)')
    .eq('status', 'pending')
    .lte('scheduled_send_at', new Date().toISOString())
    .limit(50); // Process in batches

  for (const queueItem of pendingEmails) {
    try {
      // VERIFICATION STEP
      const isValid = await verifyEmailConditions(queueItem);

      if (!isValid.valid) {
        // Cancel email
        await cancelQueuedEmail(queueItem.id, isValid.reason);
        continue;
      }

      // Check for duplicate send
      const alreadySent = await hasEmailBeenSent(
        queueItem.batch_id,
        queueItem.work_item_id,
        queueItem.email_type
      );

      if (alreadySent) {
        await cancelQueuedEmail(queueItem.id, 'Email already sent');
        continue;
      }

      // SEND EMAIL
      const communication = await sendBatchEmail(queueItem);

      // Mark as sent
      await markEmailSent(queueItem.id, communication.id);

      // Record in batch_email_sends for deduplication
      await recordEmailSend({
        batchId: queueItem.batch_id,
        workItemId: queueItem.work_item_id,
        emailType: queueItem.email_type,
        recipientEmail: queueItem.recipient_email,
        communicationId: communication.id,
        templateKey: getTemplateKey(queueItem.email_type)
      });

    } catch (error) {
      // Mark as failed, log error
      await markEmailFailed(queueItem.id, error.message);
    }
  }
}

async function verifyEmailConditions(queueItem) {
  const batch = await getBatch(queueItem.batch_id);
  const workItem = await getWorkItem(queueItem.work_item_id);

  // Check if work item still in batch
  if (workItem.batch_id !== queueItem.batch_id) {
    return { valid: false, reason: 'Work item removed from batch' };
  }

  // Check expected batch status
  if (queueItem.expected_batch_status &&
      batch.status !== queueItem.expected_batch_status) {
    return { valid: false, reason: `Batch status changed to ${batch.status}` };
  }

  // Check tracking number requirement
  if (queueItem.expected_has_tracking && !batch.tracking_number) {
    return { valid: false, reason: 'Tracking number removed' };
  }

  return { valid: true };
}
```

---

### 6. API Endpoints

#### POST `/api/batch-emails/queue`
Queue a batch email for delayed send.

**Body:**
```json
{
  "batchId": "uuid",
  "workItemId": "uuid",
  "emailType": "entering_production",
  "recipientEmail": "customer@example.com",
  "recipientName": "John Doe",
  "scheduledSendAt": "2026-02-05T10:00:00Z",
  "expectedBatchStatus": "confirmed",
  "expectedHasTracking": false
}
```

#### POST `/api/batch-emails/cancel`
Cancel a pending email.

**Body:**
```json
{
  "queueId": "uuid",
  "reason": "Manual cancellation"
}
```

#### GET `/api/batch-emails/status/:batchId`
Get email send status for a batch.

**Returns:**
```json
{
  "batchId": "uuid",
  "emails": [
    {
      "workItemId": "uuid",
      "customerName": "John Doe",
      "customerEmail": "john@example.com",
      "entering_production": {
        "status": "sent",
        "sentAt": "2026-02-05T10:00:00Z"
      },
      "midway_checkin": {
        "status": "pending",
        "scheduledFor": "2026-02-14T10:00:00Z"
      },
      "en_route": {
        "status": "not_queued"
      },
      "arrived_stateside": {
        "status": "not_queued"
      }
    }
  ]
}
```

#### POST `/api/batches/:id/mark-received`
New endpoint to mark batch as received at warehouse.

**Body:**
```json
{
  "receivedAt": "2026-03-01T10:00:00Z"  // Optional, defaults to NOW()
}
```

**Actions:**
1. Update batch: `received_at_warehouse_at = receivedAt`
2. Queue Email 4 for all work items in batch

---

### 7. React Hooks

#### `useBatchEmailStatus(batchId)`
Fetch email send status for a batch.

```typescript
export function useBatchEmailStatus(batchId: string) {
  return useQuery({
    queryKey: ['batch-email-status', batchId],
    queryFn: () => fetch(`/api/batch-emails/status/${batchId}`).then(r => r.json())
  });
}
```

#### `useQueueBatchEmail()`
Queue a batch email.

```typescript
export function useQueueBatchEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) =>
      fetch('/api/batch-emails/queue', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['batch-email-status', variables.batchId]);
    }
  });
}
```

#### `useMarkBatchReceived()`
Mark batch as received at warehouse (triggers Email 4).

```typescript
export function useMarkBatchReceived() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, receivedAt }: { id: string, receivedAt?: string }) =>
      fetch(`/api/batches/${id}/mark-received`, {
        method: 'POST',
        body: JSON.stringify({ receivedAt })
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries(['batch', id]);
      queryClient.invalidateQueries(['batches']);
      queryClient.invalidateQueries(['batch-email-status', id]);
    }
  });
}
```

---

### 8. UI Components

#### Batch Email Status Panel
Add to batch detail view (`app/batches/[id]/page.tsx`).

**Features:**
- Show email send status for each work item in batch
- Visual timeline: Email 1 → Email 2 → Email 3 → Email 4
- Status indicators: ✅ Sent | ⏰ Scheduled | ❌ Cancelled | ⚪ Not Queued
- Ability to cancel pending emails
- Button to manually trigger "Mark as Received at Warehouse"

**Example UI:**
```
Batch Email Status
─────────────────────────────────────────────────────────

Customer: John Doe (john@example.com)
  ✅ Entering Production   Sent Feb 5, 10:00 AM
  ⏰ Midway Check-In       Scheduled for Feb 14, 10:00 AM
  ⚪ En Route             Not yet queued
  ⚪ Arrived Stateside     Not yet queued

Customer: Jane Smith (jane@example.com)
  ✅ Entering Production   Sent Feb 5, 10:00 AM
  ⏰ Midway Check-In       Scheduled for Feb 14, 10:00 AM
  ⚪ En Route             Not yet queued
  ⚪ Arrived Stateside     Not yet queued

Actions:
  [Mark Batch as Received at Warehouse]
```

#### Batch Actions
Update batch action buttons to include:
- "Mark as Received" button (triggers Email 4)
- "View Email Status" link

---

### 9. Safety Features

#### 1. Deduplication (Prevent Resends)
- UNIQUE constraint on `batch_email_sends(batch_id, work_item_id, email_type)`
- Check `batch_email_sends` before sending
- UNIQUE constraint on `batch_email_queue(batch_id, work_item_id, email_type)`

#### 2. Delayed Send (5-minute verification window)
- All emails queued with `scheduled_send_at = NOW() + 5 minutes`
- Cron job verifies conditions before sending
- If conditions changed → cancel, don't send

#### 3. Condition Verification
Before sending, verify:
- Work item still in batch
- Batch status matches expected status
- Tracking number present (if required)
- Batch not deleted

#### 4. Manual Cancellation
- UI button to cancel pending emails
- API endpoint to cancel by queue ID
- Cancellation reason logged for audit

#### 5. Idempotent Triggers
- Status change handlers check if emails already queued
- Handle case where batch is confirmed multiple times (shouldn't re-queue)

---

### 10. Migration Order

1. **Migration 1:** Create `batch_email_queue` table
2. **Migration 2:** Create `batch_email_sends` table
3. **Migration 3:** Add `received_at_warehouse_at` to batches table
4. **Migration 4:** Seed email templates (4 templates)
5. **Code:** API endpoints for queueing, cancelling, status
6. **Code:** Cron job for processing queue
7. **Code:** Hook into batch confirmation, tracking update
8. **Code:** New "Mark as Received" mutation and endpoint
9. **Code:** React hooks for email management
10. **Code:** UI components for email status display

---

### 11. Email Content Configuration

#### Discount Code
- Hardcoded: `WAIT20` (20% off ready-to-ship)
- Could be made configurable via environment variable later

#### Shop URLs
- Shop Fan Favorites: `https://thegayfanclub.com/collections/fan-favorites`
- Shop Clearance: `https://thegayfanclub.com/collections/clearance`
- Configurable via environment variable: `NEXT_PUBLIC_SHOP_URL`

#### Sender Email
- From: `sales@thegayfanclub.com` (existing Microsoft mailbox)
- Reply-to: Same

---

### 12. Testing Checklist

#### Unit Tests
- [ ] Email template rendering
- [ ] Merge field replacement
- [ ] Date calculation (1 day, 10 days)
- [ ] Condition verification logic

#### Integration Tests
- [ ] Queue email creation
- [ ] Email send with Microsoft Graph
- [ ] Duplicate prevention
- [ ] Cancellation flow

#### End-to-End Tests
- [ ] Confirm batch → Email 1 & 2 queued
- [ ] Change status back → Emails cancelled
- [ ] Add tracking → Email 3 queued
- [ ] Mark received → Email 4 queued
- [ ] All 4 emails send successfully
- [ ] No duplicate sends on re-trigger

#### Edge Cases
- [ ] Work item removed from batch before send
- [ ] Batch deleted before send
- [ ] Tracking number removed before send
- [ ] Customer email missing
- [ ] Template missing

---

### 13. Monitoring & Observability

#### Metrics to Track
- Total emails queued per day
- Total emails sent per day
- Total emails cancelled per day
- Failed sends (with error reasons)
- Average delay between schedule and send

#### Logging
- Log all queue creations
- Log all verification checks
- Log all cancellations with reasons
- Log all send failures

#### Alerts
- Alert if send failure rate > 5%
- Alert if queue processing stops
- Alert if verification cancels > 20% of emails

---

### 14. Future Enhancements

#### Phase 2 Ideas
- [ ] Email preview before queueing
- [ ] Manual email send override (skip verification)
- [ ] Batch email report (sent vs pending)
- [ ] Customer preference for email frequency
- [ ] A/B test email subject lines
- [ ] Dynamic discount codes per batch
- [ ] SMS notifications in addition to email

---

## Implementation Timeline

**Estimated Total: 8-12 hours**

1. **Database Schema (1 hour)**
   - Create tables, indexes, constraints
   - Update batches table

2. **Email Templates (1 hour)**
   - Write HTML for 4 emails
   - Create seed migration
   - Test template rendering

3. **Queue System (2 hours)**
   - API endpoints for queue management
   - Condition verification logic
   - Duplicate detection

4. **Cron Job (1.5 hours)**
   - Process queue endpoint
   - Error handling
   - Logging

5. **Trigger Integration (2 hours)**
   - Hook into batch confirmation
   - Hook into tracking update
   - Create "mark received" endpoint

6. **React Hooks (1 hour)**
   - Status fetching
   - Queue mutation
   - Mark received mutation

7. **UI Components (1.5 hours)**
   - Email status panel
   - Cancel buttons
   - Mark received button

8. **Testing (2 hours)**
   - End-to-end flow
   - Edge cases
   - Error scenarios

---

## Questions to Resolve

1. **Email Timing:** Confirm exact timing preferences:
   - Email 1: Exactly 1 day after confirmation? Or immediate with 5-min delay?
   - Email 2: Exactly 10 days or 10 business days?

2. **Batch Status Flow:** Does a batch go through all these statuses?
   - draft → confirmed → exported → received_at_warehouse?
   - Or is "exported" optional?

3. **Alternate Emails:** Should we send to alternate_emails as well, or only primary?

4. **Cancel Behavior:** If batch status changes back (e.g., confirmed → draft), should we:
   - Cancel all pending emails?
   - Or leave them queued?

5. **Resend Capability:** Should there be a way to manually resend an email if needed?

6. **Time Zone:** What time zone should scheduled sends use? (UTC, ET, etc.)

7. **Work Item Status:** Should work items get a status update when emails are sent?
   - E.g., add a note to work_item_status_events?

---

## Dependencies

### External
- Microsoft Graph API (already integrated)
- Supabase (already integrated)

### Internal
- Email template system (existing)
- Communications logging (existing)
- Batch management hooks (existing)
- Cron infrastructure (existing)

### New
- Date manipulation library (date-fns recommended)
- Email HTML builder/renderer (if templates need complexity)

---

## Risk Mitigation

### Risk: Accidental Mass Send
**Mitigation:**
- 5-minute delay + verification
- Deduplication checks
- Manual cancellation capability

### Risk: Missing Customer Email
**Mitigation:**
- Skip work items without email
- Log skipped items
- Add warning in UI

### Risk: Template Rendering Failure
**Mitigation:**
- Fallback to plain text
- Log rendering errors
- Don't send broken emails

### Risk: Cron Job Failure
**Mitigation:**
- Retry failed sends
- Alert on repeated failures
- Manual retry capability in UI

### Risk: Email Delivery Failure
**Mitigation:**
- Log Microsoft Graph API errors
- Mark email as failed (not sent)
- Allow manual retry

---

## Success Criteria

✅ All 4 emails send automatically at correct trigger points
✅ No duplicate emails sent
✅ 5-minute verification window prevents accidental sends
✅ UI shows clear email status for each batch
✅ Failed sends are logged and can be retried
✅ System handles edge cases gracefully (deleted batches, removed items, etc.)
✅ Email content renders correctly with merge fields
✅ Customers receive personalized, branded emails

---

## Rollout Plan

### Phase 1: Development & Testing (Days 1-2)
- Build database schema
- Create email templates
- Implement queue system
- Build cron processor

### Phase 2: Integration (Day 3)
- Hook into batch flows
- Create UI components
- End-to-end testing

### Phase 3: Staging (Day 4)
- Deploy to staging environment
- Test with real batch data
- Verify email sends with test accounts

### Phase 4: Production Soft Launch (Day 5)
- Enable for 1-2 test batches
- Monitor closely
- Fix any issues

### Phase 5: Full Production (Day 6+)
- Enable for all batches
- Monitor email metrics
- Iterate based on customer feedback
