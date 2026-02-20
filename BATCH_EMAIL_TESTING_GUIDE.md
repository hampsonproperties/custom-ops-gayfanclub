# Batch Email Testing & Safety Guide

## 🛡️ Safety: Preventing Emails from Going to Wrong People

### Built-in Safety Features

#### 1. **5-Minute Verification Delay**
Every email waits 5 minutes before sending. During this time, the system verifies:
- Work item still exists and is in the batch
- Customer email addresses are valid
- Batch status hasn't changed
- Tracking number is still present (if required)

**If ANY condition fails → email is automatically cancelled**

#### 2. **Email Source Validation**
Emails ONLY go to addresses from:
- `work_items.customer_email` (primary email)
- `work_items.alternate_emails` (alternate emails array)

**No other email addresses can receive batch emails**

#### 3. **Deduplication Protection**
Multiple safeguards prevent duplicate sends:
- Database UNIQUE constraint on `batch_email_queue(batch_id, work_item_id, email_type)`
- Database UNIQUE constraint on `batch_email_sends(batch_id, work_item_id, email_type)`
- Pre-send duplicate check in cron job

**Each email type can only be sent ONCE per batch/customer**

#### 4. **Batch Membership Check**
Before sending, system verifies:
```sql
-- Work item must be in the batch
SELECT * FROM batch_items
WHERE batch_id = ? AND work_item_id = ?
```

If work item removed from batch → email cancelled

#### 5. **No Manual Trigger = No Email**
Emails ONLY queue when:
- You click "Confirm Batch" (triggers Email 1 & 2)
- You add tracking number (triggers Email 3)
- You click "Mark Batch as Received" (triggers Email 4)

**No automatic triggers on customer data changes**

---

## 🧪 Testing Approach: Safe Rollout Strategy

### Phase 1: Email Design Preview (NO SENDS)

**Preview emails in browser without sending:**

1. Navigate to these URLs in your browser after migrations:
   ```
   http://localhost:3000/api/batch-emails/preview?type=entering_production&firstName=John
   http://localhost:3000/api/batch-emails/preview?type=midway_checkin&firstName=Jane
   http://localhost:3000/api/batch-emails/preview?type=en_route&firstName=Alex
   http://localhost:3000/api/batch-emails/preview?type=arrived_stateside&firstName=Sam
   ```

2. Review the design, layout, and branding
3. Check links work (Fan Faves, Sale, New Arrivals)
4. Verify logo displays correctly
5. Check mobile responsiveness (resize browser)

**No emails sent in this phase - just HTML preview**

---

### Phase 2: Test with Internal Emails Only

**Create a test batch with YOUR email addresses:**

#### Step 1: Create Test Work Items
```sql
-- In Supabase SQL editor, create test work items with YOUR email
INSERT INTO work_items (
  type,
  source,
  title,
  status,
  customer_name,
  customer_email,
  alternate_emails,
  quantity,
  grip_color
) VALUES (
  'customify_order',
  'manual',
  'TEST ORDER - Delete after testing',
  'approved',
  'Test Customer 1',
  'YOUR_EMAIL@example.com',  -- PUT YOUR EMAIL HERE
  ARRAY['YOUR_SECOND_EMAIL@example.com'],  -- Optional alternate email
  1,
  'Black'
),
(
  'customify_order',
  'manual',
  'TEST ORDER 2 - Delete after testing',
  'approved',
  'Test Customer 2',
  'YOUR_TEAM_EMAIL@example.com',  -- Another team member's email
  ARRAY[],
  1,
  'White'
);
```

#### Step 2: Create Test Batch
1. Go to your batches page
2. Create new batch named "TEST BATCH - DELETE AFTER TESTING"
3. Add the test work items you just created
4. **DO NOT CONFIRM YET**

#### Step 3: Test Email 1 & 2 (Entering Production + Midway)
1. Click "Confirm Batch" on your test batch
2. Go to "Customer Email Notifications" section
3. You should see:
   - Email 1 scheduled for ~1 day from now
   - Email 2 scheduled for ~10 days from now

4. **To test immediately (skip the 1-day wait):**
   ```sql
   -- Update scheduled times to 1 minute from now
   UPDATE batch_email_queue
   SET scheduled_send_at = NOW() + INTERVAL '1 minute'
   WHERE batch_id = 'YOUR_TEST_BATCH_ID'
   AND status = 'pending';
   ```

5. Wait 2 minutes, then manually trigger cron:
   ```bash
   curl -X GET http://localhost:3000/api/cron/process-batch-emails \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

6. Check YOUR email inbox - you should receive the emails

#### Step 4: Test Email 3 (En Route)
1. Click "Add Tracking" on test batch
2. Enter fake tracking number: "TEST-TRACKING-123"
3. Email 3 should be scheduled for 5 minutes from now
4. Wait 5 minutes
5. Trigger cron manually (or wait for automatic cron)
6. Check your inbox

#### Step 5: Test Email 4 (Arrived Stateside)
1. Click "Mark Batch as Received"
2. Confirm the action
3. Email 4 should be scheduled for 5 minutes from now
4. Wait 5 minutes
5. Trigger cron manually
6. Check your inbox

#### Step 6: Clean Up Test Data
```sql
-- Delete test batch
DELETE FROM batches WHERE name LIKE 'TEST BATCH%';

-- Delete test work items
DELETE FROM work_items WHERE title LIKE 'TEST ORDER%';

-- Delete test emails
DELETE FROM batch_email_queue WHERE batch_id IN (
  SELECT id FROM batches WHERE name LIKE 'TEST BATCH%'
);
DELETE FROM batch_email_sends WHERE batch_id IN (
  SELECT id FROM batches WHERE name LIKE 'TEST BATCH%'
);
```

---

### Phase 3: Test Cancellation Safety

**Verify emails cancel when conditions change:**

#### Test 1: Status Change Cancellation
1. Create test batch and confirm it (queues Email 1 & 2)
2. **Within 5 minutes**, change batch status:
   ```sql
   UPDATE batches
   SET status = 'draft'
   WHERE id = 'YOUR_TEST_BATCH_ID';
   ```
3. Wait for scheduled send time
4. Trigger cron
5. Check email status - should show "Cancelled"
6. **No emails should arrive in your inbox**

#### Test 2: Tracking Removal Cancellation
1. Add tracking to batch (queues Email 3)
2. **Within 5 minutes**, remove tracking:
   ```sql
   UPDATE batches
   SET tracking_number = NULL
   WHERE id = 'YOUR_TEST_BATCH_ID';
   ```
3. Wait 5 minutes
4. Trigger cron
5. Check email status - should show "Cancelled"
6. **No email should arrive**

#### Test 3: Work Item Removal Cancellation
1. Confirm batch (queues Email 1 & 2 for all items)
2. **Within 5 minutes**, remove a work item:
   ```sql
   DELETE FROM batch_items
   WHERE batch_id = 'YOUR_TEST_BATCH_ID'
   AND work_item_id = 'SPECIFIC_WORK_ITEM_ID';
   ```
3. Wait for scheduled send time
4. Trigger cron
5. Removed work item should get cancelled email
6. Other work items should still receive their emails

---

### Phase 4: Production Soft Launch

**Test with 1-2 real batches under close monitoring:**

#### Before First Production Batch:
1. ✅ All Phase 1-3 tests passed
2. ✅ Email designs look good
3. ✅ All safety features working
4. ✅ Cancellation working correctly
5. ✅ Cron job running automatically every minute

#### First Production Batch:
1. Create batch with 2-3 real customer orders
2. **CRITICAL: Double-check customer emails are correct**
3. Confirm batch
4. Monitor the "Customer Email Notifications" section
5. Watch for scheduled emails
6. Monitor cron job logs
7. Verify emails send successfully
8. Check customers receive emails

#### Monitoring First Week:
- Check batch email status daily
- Monitor cron job success rate
- Watch for failed sends
- Check communications table for logging
- Ask customers if emails look good

---

## 🔍 How to Verify Emails Will Send

### Pre-Flight Checklist

Before confirming any batch, verify:

1. **Customer Emails Are Valid**
   ```sql
   -- Check all emails in batch are set
   SELECT wi.id, wi.customer_name, wi.customer_email, wi.alternate_emails
   FROM work_items wi
   JOIN batch_items bi ON bi.work_item_id = wi.id
   WHERE bi.batch_id = 'YOUR_BATCH_ID'
   AND (wi.customer_email IS NULL OR wi.customer_email = '');
   ```
   **Result should be empty** (no rows = all emails are set)

2. **Cron Job Is Running**
   ```bash
   curl -X GET https://yourdomain.com/api/cron/process-batch-emails \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```
   Should return:
   ```json
   {"success": true, "processed": 0, "sent": 0, ...}
   ```

3. **Microsoft Graph Credentials Work**
   Test by sending a normal email through your system first

4. **Templates Exist**
   ```sql
   SELECT key, name, is_active
   FROM templates
   WHERE key LIKE 'batch-%';
   ```
   Should return 4 templates, all active

### Post-Queue Verification

After confirming a batch:

1. **Check Emails Were Queued**
   ```sql
   SELECT
     email_type,
     recipient_email,
     scheduled_send_at,
     status
   FROM batch_email_queue
   WHERE batch_id = 'YOUR_BATCH_ID'
   ORDER BY scheduled_send_at;
   ```
   You should see emails with status = 'pending'

2. **Monitor Queue Over Time**
   Check back after scheduled send times to see status change to 'sent'

3. **Check Send Log**
   ```sql
   SELECT
     email_type,
     recipient_email,
     sent_at,
     template_key
   FROM batch_email_sends
   WHERE batch_id = 'YOUR_BATCH_ID'
   ORDER BY sent_at;
   ```
   Successful sends appear here

### Ongoing Monitoring

**Daily Check:**
```sql
-- Pending emails that are overdue
SELECT *
FROM batch_email_queue
WHERE status = 'pending'
AND scheduled_send_at < NOW() - INTERVAL '10 minutes';
```
**Should be empty** (if not, cron may not be running)

**Weekly Report:**
```sql
-- Email send success rate (last 7 days)
SELECT
  email_type,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
  ROUND(100.0 * COUNT(CASE WHEN status = 'sent' THEN 1 END) / NULLIF(COUNT(*), 0), 2) as success_rate
FROM batch_email_queue
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY email_type;
```

---

## 🎨 Email Design Testing

### Method 1: Browser Preview (Recommended)

I'll create a preview endpoint for you. After I create it, you can:

1. Go to: `http://localhost:3000/api/batch-emails/preview?type=entering_production`
2. Change `type` parameter to preview different emails:
   - `entering_production`
   - `midway_checkin`
   - `en_route`
   - `arrived_stateside`
3. Add `firstName` parameter to test personalization:
   - `?type=entering_production&firstName=Timothy`

**Let me create that endpoint now...**

### Method 2: Send Test Email to Yourself

```sql
-- Queue a test email immediately
INSERT INTO batch_email_queue (
  batch_id,
  work_item_id,
  email_type,
  recipient_email,
  recipient_name,
  scheduled_send_at,
  status
) VALUES (
  (SELECT id FROM batches LIMIT 1),  -- Any batch ID
  (SELECT id FROM work_items LIMIT 1),  -- Any work item ID
  'entering_production',
  'YOUR_EMAIL@example.com',  -- YOUR EMAIL
  'Test Name',
  NOW() + INTERVAL '1 minute',  -- Send in 1 minute
  'pending'
);
```

Wait 2 minutes, trigger cron, check your email.

### Method 3: Email Testing Tools

Use these services to test email rendering:
- **Litmus** (paid) - https://litmus.com
- **Email on Acid** (paid) - https://www.emailonacid.com
- **Mail Tester** (free) - https://www.mail-tester.com

Send test emails to their testing addresses to see:
- How it looks in different email clients
- Spam score
- Mobile/desktop rendering
- Dark mode compatibility

---

## 🚨 Safety Checklist Before Going Live

### Critical Safety Checks

- [ ] Tested with internal emails only (Phase 2)
- [ ] Verified cancellation works (Phase 3)
- [ ] Confirmed no test data in production
- [ ] Double-checked all template links go to correct URLs
- [ ] Verified WAIT20 discount code is active
- [ ] Tested all 4 email types
- [ ] Confirmed cron job runs every minute
- [ ] Microsoft Graph credentials working
- [ ] Checked email designs in multiple email clients
- [ ] Verified deduplication prevents double-sends
- [ ] Tested with both primary and alternate emails

### Production Readiness

- [ ] Migrations run successfully
- [ ] All 4 templates active in database
- [ ] Cron job configured and running
- [ ] Monitoring dashboard set up (optional)
- [ ] Team trained on how to use the system
- [ ] Documented process for cancelling emails if needed
- [ ] Have a rollback plan (stop cron, cancel pending emails)

---

## 🆘 Emergency Stop Procedure

**If you need to stop all emails immediately:**

### Step 1: Stop the Cron Job
Disable your cron job configuration (depends on your setup)

### Step 2: Cancel All Pending Emails
```sql
UPDATE batch_email_queue
SET status = 'cancelled',
    cancelled_at = NOW(),
    cancellation_reason = 'Emergency stop by admin'
WHERE status = 'pending';
```

### Step 3: Verify No Emails in Queue
```sql
SELECT COUNT(*)
FROM batch_email_queue
WHERE status = 'pending';
```
Should return 0

### Step 4: Re-enable When Ready
1. Fix any issues
2. Re-enable cron job
3. Manually queue any emails that need to be sent

---

## 📊 Success Metrics to Track

### Week 1 Metrics
- Total emails queued: ___
- Total emails sent: ___
- Total emails cancelled: ___
- Total emails failed: ___
- Success rate: ____%

### Monitor These
- Email delivery rate (should be >95%)
- Cancellation rate (should be <5%)
- Failed send rate (should be <1%)
- Customer complaints about emails (should be 0)

---

## 💡 Best Practices

### Before Confirming Any Batch

1. **Review customer list** in batch detail page
2. **Verify email addresses** are correct
3. **Check for test/dummy emails** - remove them
4. **Confirm you want emails to go out** for this batch
5. Only then click "Confirm Batch"

### Regular Maintenance

- **Weekly**: Check failed sends and retry if needed
- **Monthly**: Review cancellation reasons for patterns
- **Quarterly**: Review email content and update if needed

### Customer Communication

Consider adding a note in your confirmation emails:
> "You'll receive 4 automated updates as your custom order progresses through production. You can unsubscribe at any time by contacting us."

---

## ✅ You're Ready When...

- [ ] You can preview all 4 emails in browser
- [ ] Test batch with your email works perfectly
- [ ] Cancellation safety features verified
- [ ] Cron job running reliably
- [ ] You understand the emergency stop procedure
- [ ] Team knows how to check email status
- [ ] First test batch went smoothly

**Then you can start using it with real customer batches!** 🚀

---

## 🎯 Quick Reference

**Preview Emails:**
- URL: `/api/batch-emails/preview?type=EMAILTYPE&firstName=NAME`

**Manual Cron Trigger:**
```bash
curl -H "Authorization: Bearer CRON_SECRET" https://domain.com/api/cron/process-batch-emails
```

**Check Pending Emails:**
```sql
SELECT * FROM batch_email_queue WHERE status = 'pending';
```

**Emergency Stop:**
```sql
UPDATE batch_email_queue SET status = 'cancelled' WHERE status = 'pending';
```

**Check Sent Emails:**
```sql
SELECT * FROM batch_email_sends ORDER BY sent_at DESC;
```
