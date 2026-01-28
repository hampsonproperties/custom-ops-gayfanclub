# Custom Design Workflow Guide

## Overview

Custom Ops now supports TWO distinct workflows:

1. **Customify Orders** - Customer designs via Customify, we review and approve
2. **Custom Design Projects** - We design for the customer, iterate until approved

This guide explains how the Custom Design workflow works.

---

## Entry Points

### Path 1: Email Inquiry First (Most Common)

```
Customer emails inquiry
  ↓
Email Intake Queue → Create Lead
  ↓
Work Item created:
  - type: assisted_project
  - status: new_inquiry
  - customer_email: saved
  ↓
You email back: "Pay design fee here: [link]"
  ↓
Status: design_fee_sent
  ↓
Customer pays $35 → Shopify Order #XXXX
  ↓
Webhook finds existing work item by email
  ↓
Updates work item:
  - shopify_order_id: linked
  - status: design_fee_paid
  ↓
Ready to start designing!
```

### Path 2: Direct Payment (No Inquiry)

```
Customer pays design fee directly
  ↓
Shopify Order #XXXX created
  ↓
Webhook detects "Professional Custom Fan Design Service"
  ↓
Creates new work item:
  - type: assisted_project
  - status: design_fee_paid
  - customer info from Shopify
  ↓
Ready to start designing!
```

---

## Design Iteration Workflow

### 1. Start Designing

**Status**: `design_fee_paid` → `in_design`

**Actions**:
- Navigate to work item detail page
- Review customer requirements (from inquiry emails in Timeline)
- Create design proof

### 2. Upload Proof

**Actions**:
- Go to **Files** tab
- Click **Upload File**
- Select your design file
- Choose **File Type**: `Proof (Design we created)`
- Add note: "Proof v1" or "Revised based on feedback"
- Click **Upload**

### 3. Send Proof to Customer

**Status**: `in_design` → `proof_sent` or `awaiting_approval`

**Actions**:
- Go to **Communication** tab
- Click **Send Email**
- Subject: "Your custom design proof is ready!"
- Body: Include link to view design, ask for feedback
- Click **Send Email**

**Email will include**:
- Link to design file (from Files tab)
- Request for approval or feedback

### 4. Customer Reviews

**Two Paths**:

#### A) Customer Approves ✅
```
Customer replies: "Looks great!"
  ↓
Status: awaiting_approval → invoice_sent
  ↓
You create invoice for actual fan order
  ↓
Send invoice via Shopify (draft order or invoice)
  ↓
Customer pays
  ↓
Status: invoice_sent → paid_ready_for_batch
  ↓
Ready for production!
```

#### B) Customer Requests Changes 🔄
```
Customer replies: "Can you change the color?"
  ↓
Status: awaiting_approval → in_design
  ↓
Revise design
  ↓
Upload new proof (Files tab will version it automatically)
  ↓
Send revised proof
  ↓
Status: in_design → proof_sent
  ↓
Repeat until approved
```

---

## Status Flow Reference

```
new_inquiry
  ↓
info_sent (optional - if you send info first)
  ↓
design_fee_sent
  ↓
design_fee_paid (payment received)
  ↓
in_design (we're designing)
  ↓
proof_sent (we sent proof)
  ↓
awaiting_approval (customer reviewing)
  ↓ (if changes needed)
in_design (back to designing)
  ↓ (once approved)
invoice_sent (final order invoice sent)
  ↓
paid_ready_for_batch (payment received, ready for batch)
  ↓
batched → shipped → closed
```

---

## "Who Has the Ball?"

The system tracks who currently needs to take action:

**We Have the Ball**:
- `in_design` - We need to create/revise the design

**Customer Has the Ball**:
- `proof_sent` - Waiting for customer feedback
- `awaiting_approval` - Customer reviewing proof
- `invoice_sent` - Waiting for payment

**Visual Indicators**:
- 🎨 Purple badge = We're designing
- 👤 Orange badge = Awaiting customer (with days waiting)
- 💰 Green badge = Awaiting payment

---

## Files Tab Usage

### Uploading Design Proofs

1. Go to work item detail → **Files** tab
2. Click **Upload File**
3. Select file (PNG, JPG, PDF recommended)
4. Choose type: **Proof (Design we created)**
5. Add note describing the version/changes
6. Upload

**File Versioning**:
- First proof: `proof-v1-design.png`
- Second proof: `proof-v2-design.png`
- System auto-increments version numbers

### Viewing Files

- **Grid view** shows all files with thumbnails
- **Customify files** marked with "(Customify)" badge
- **View button** opens full-size image in new tab
- **Download button** for non-image files

### File Sources

- **Your uploads**: Stored in Supabase Storage
- **Customify imports**: Linked to external S3 URLs
- Both display together in Files tab

---

## Email Communication

### Templates (Future Feature)

Once templates are set up, you can:
- Select template: "Design Proof Ready"
- Merge fields auto-populate: `{customer_name}`, `{design_url}`
- Edit message before sending
- Send with one click

### Manual Emails (Current)

**Proof Ready Email Example**:

```
To: customer@example.com
Subject: Your Custom Fan Design - Proof v1 Ready!

Hi Sarah,

Great news! I've created the first proof of your custom fan design.

You can view it here: [paste file URL from Files tab]

Please let me know:
- Does this match your vision?
- Any changes you'd like?
- Ready to approve and move forward?

Looking forward to your feedback!

Best,
[Your Name]
```

---

## Creating Final Order Invoice

When customer approves the design:

### Option A: Draft Order (Recommended)

1. Go to Shopify Admin → Orders → Drafts → Create draft order
2. Add customer
3. Add fan products with correct quantity/options
4. Apply design fee credit: Add line item "Design Fee Credit" for -$35
5. Review → Send invoice
6. When paid → Webhook updates Custom Ops status to `paid_ready_for_batch`

### Option B: Manual Invoice

1. Use external invoicing tool (QuickBooks, etc.)
2. Manually update work item status to `invoice_sent` in Custom Ops
3. When paid, manually update status to `paid_ready_for_batch`

---

## Linking Orders Mid-Workflow

If the Shopify order doesn't auto-link (edge case):

**Future Feature**: "Link to Order" button in work item detail
- Enter Shopify order number
- System fetches order data and links it

**Current Workaround**: Update via database directly

---

## Dashboard View

New stats on dashboard:

**Custom Designs Active**: Shows count grouped by:
- X designing (we have the ball)
- X awaiting approval (customer reviewing)
- X awaiting payment (invoice sent)

---

## FAQ

### Q: How does the system know to link the design fee payment?

A: When the webhook receives a "Professional Custom Fan Design Service & Credit" order, it:
1. Looks for existing work item with matching customer email
2. If found in `new_inquiry` or `design_fee_sent` status → Updates that item
3. If not found → Creates new item

### Q: What if customer has multiple inquiries?

A: System matches the most recent open inquiry. If multiple projects, you may need to manually link the correct one.

### Q: Can we track multiple design versions?

A: Yes! Files tab auto-versions:
- Upload proof → `proof-v1-...`
- Upload again → `proof-v2-...`
- Timeline shows all uploads with timestamps

### Q: How do we handle revisions after payment?

A: Even after `paid_ready_for_batch`, you can:
- Upload new file versions
- Send emails from Communication tab
- Files tab maintains full history

---

## Testing the Workflow

### End-to-End Test

1. **Create Inquiry**:
   - Insert test email in `email_intake_queue`
   - Triage → Create Lead → Fill form
   - Verify work item created with `status = new_inquiry`

2. **Send Design Fee Link**:
   - Communication tab → Send Email
   - Update status to `design_fee_sent`

3. **Simulate Payment**:
   - Create Shopify order with "Professional Custom Fan Design Service"
   - Use test customer email
   - Trigger webhook (or use reprocess endpoint)
   - Verify status updates to `design_fee_paid`

4. **Upload Proof**:
   - Files tab → Upload proof image
   - Verify appears in grid with version number

5. **Iterate**:
   - Change status to `proof_sent`
   - Upload second version
   - Change status to `awaiting_approval`

6. **Approve & Invoice**:
   - Change status to `invoice_sent`
   - Create draft order in Shopify
   - Mark as paid → Status becomes `paid_ready_for_batch`

---

## Next Steps

Future enhancements:
- **Custom Design Queue page** - Dedicated view grouped by ball possession
- **Template system UI** - Pre-built email templates
- **Draft order API** - Auto-create draft orders from Custom Ops
- **Payment tracking** - Sync Shopify payment status automatically

---

Need help? Check work item detail page Timeline tab for full audit trail of all actions!
