# 🎯 LEAD-FOCUSED ARCHITECTURE DESIGN

## Executive Summary

Rebuilding from EMAIL-FOCUSED → LEAD-FOCUSED CRM for 4-10 person team managing custom fan sales and production.

---

## PRIMARY DASHBOARD (What you see when you open the app)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🎯 The Gay Fan Club - Command Center                                   │
├──────────────────────────────┬──────────────────────────────────────────┤
│                              │                                          │
│  📊 SALES PIPELINE           │  🏭 PRODUCTION PIPELINE                  │
│  (34 active leads)           │  (63 active projects)                    │
│                              │                                          │
│  🚨 OVERDUE (5)              │  🔥 URGENT - Event <7 days (3)           │
│  ├─ CorazonSA - $2,500       │  ├─ Alicia Rothery - Ships 2/25         │
│  ├─ Dylan Kohere - 28d ago   │  ├─ Elizabeth Tillman - Event 2/28      │
│  └─ ...                      │  └─ ...                                  │
│                              │                                          │
│  📅 DUE TODAY (2)            │  ⏳ NEEDS DESIGN REVIEW (5)              │
│  ├─ New inquiry - Dammy      │  ├─ Sarah Wedding - Awaiting approval   │
│  └─ ...                      │  └─ ...                                  │
│                              │                                          │
│  🆕 NEW INQUIRIES (8)        │  ✅ READY FOR BATCH (8)                  │
│  ├─ Houston LGBT Chamber     │  ├─ nicole maxson                        │
│  ├─ Tola NYC                 │  └─ ...                                  │
│  └─ ...                      │                                          │
│                              │  📦 IN PRODUCTION (24)                   │
│  💤 WAITING ON CUSTOMER (6)  │  └─ Batched orders                       │
│                              │                                          │
│  📧 NEEDS TRIAGE (0)         │  🚚 SHIPPED THIS WEEK (1)                │
│  └─ New emails to review     │  └─ Recent completions                   │
│                              │                                          │
└──────────────────────────────┴──────────────────────────────────────────┘
```

**Key Features:**
- Split view: Sales left, Production right
- Priority sorting: Overdue > Due Today > Event Date > Value
- Color coding: Red (overdue), Orange (urgent), Green (on track)
- Click any item → Opens Lead Detail page

---

## LEAD DETAIL PAGE (Primary work surface)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back to Dashboard                                    CorazonSA #1234 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  👤 CUSTOMER INFO                                  📊 PROJECT STATUS    │
│  Diane @ CorazonSA                                                      │
│  diane@corazonsa.org                               🚨 OVERDUE           │
│  📞 (555) 123-4567                                 💰 $2,500            │
│  🏢 San Antonio, TX                                📅 Event: 3/15       │
│  ⭐ Repeat customer (3 orders)                     👤 Assigned: You     │
│                                                    🏷️  Tags: VIP, Rush  │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📋 TABS:                                                               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                         │
│  [Activity] [Communication] [Files] [Orders] [Notes]                   │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│  ACTIVITY TAB (Selected)                                                │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  📝 QUICK ACTIONS                                                       │
│  [Send Email ▼] [Add Note] [Update Status ▼] [Upload File]             │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│  TIMELINE                                                               │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  🔴 25 days ago - Invoice #SO-1234 PAST DUE                             │
│     💰 $2,500 payment overdue                                           │
│     [Send Reminder] [Mark Paid] [Call Customer]                         │
│                                                                         │
│  📧 25 days ago - Email from Diane                                      │
│     "RE: Your Custom Hand Fans - Payment past due"                      │
│     [Reply] [View Full Email]                                           │
│                                                                         │
│  📝 33 days ago - Internal Note by Timothy                              │
│     🔒 PRIVATE: "Diane said she needs NET30 terms, approved by         │
│     management. Follow up on 2/25 if not paid."                         │
│                                                                         │
│  📧 33 days ago - Email sent to diane@corazonsa.org                     │
│     Subject: "Invoice for CorazonSA Custom Fans"                        │
│     [View Email]                                                        │
│                                                                         │
│  📁 35 days ago - File uploaded: corazon_design_v3.pdf                  │
│     Uploaded by: Timothy                                                │
│     [Download] [Preview]                                                │
│                                                                         │
│  ✅ 35 days ago - Status changed: Design Approved → Invoice Sent        │
│     Changed by: Timothy                                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Customer context** always visible (top card)
- **All communication** in one timeline (emails, notes, files, status changes)
- **Quick actions** without leaving page
- **Private notes** for internal team discussion
- **Assignment** visible - know who owns this
- **Tags** for categorization

---

## COMMUNICATION TAB (Email history + inline composer)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  COMMUNICATION                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📧 QUICK REPLY                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ To: diane@corazonsa.org                                         │   │
│  │ Template: [Payment Reminder ▼] or type manually...              │   │
│  │                                                                 │   │
│  │ Hi Diane,                                                       │   │
│  │                                                                 │   │
│  │ I hope this email finds you well. I wanted to follow up        │   │
│  │ regarding invoice #SO-1234 for $2,500 which is now 25 days     │   │
│  │ past due.                                                       │   │
│  │                                                                 │   │
│  │ [Send] [Save Draft] [Add CC/BCC]                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│  EMAIL THREAD (Most recent first)                                       │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  📧 Feb 22, 2026 - From: diane@corazonsa.org                            │
│  Subject: RE: Your Custom Hand Fans - Payment past due                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Hi Timothy,                                                     │   │
│  │                                                                 │   │
│  │ I'm working on getting you the payment. We've had some cash    │   │
│  │ flow issues but should have it by end of week.                 │   │
│  │                                                                 │   │
│  │ Thanks for your patience,                                      │   │
│  │ Diane                                                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  [Reply] [Forward] [Add Note]                                           │
│                                                                         │
│  📧 Jan 28, 2026 - From: sales@thegayfanclub.com                        │
│  Subject: Invoice for CorazonSA Custom Fans                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ [Invoice details...]                                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  [View Full Email]                                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Quick reply** at top (no need to leave page)
- **Template picker** with 7 pre-built templates
- **Full email thread** chronological
- **Inline actions** (reply, forward, add note)

---

## NOTES TAB (Internal team collaboration)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  INTERNAL NOTES                                        🔒 TEAM ONLY     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ➕ ADD NOTE                                                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Add internal note (not visible to customer)                    │   │
│  │                                                                 │   │
│  │ @mention team members to notify them                           │   │
│  │                                                                 │   │
│  │ [Save Note] [Cancel]                                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│  NOTE HISTORY                                                           │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  📝 Feb 20, 2026 at 3:45 PM - Timothy                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 🔒 Diane called today. She's approved for NET30 terms moving    │   │
│  │ forward. @Sarah - can you update her account settings?          │   │
│  │                                                                 │   │
│  │ Also, she wants to place another order for 500 fans for their  │   │
│  │ March event. I'll send quote tomorrow.                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  [Edit] [Delete]                                                        │
│                                                                         │
│  📝 Jan 15, 2026 at 10:22 AM - Sarah                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 🔒 FYI - CorazonSA is a nonprofit. They're always slow to pay   │   │
│  │ but they DO pay eventually. Just be patient.                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Private notes** - never sent to customer
- **@mentions** - notify team members
- **Timestamped** with author
- **Editable** - update as situation changes

---

## INBOX (Triage-only, not primary workflow)

**New role:** Just for triaging NEW untriaged emails, not for working

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📧 INBOX - Triage New Emails                                           │
│  (Should be mostly empty after you triage)                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  🆕 NEEDS TRIAGE (2)                                                    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 📧 From: newcustomer@example.com                                │   │
│  │ Subject: "Custom fans for June wedding"                         │   │
│  │ Preview: "Hi, I'm looking for 100 custom fans for my wedding..."│   │
│  │                                                                 │   │
│  │ [Create Lead] [Link to Existing] [Archive as Junk]              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 📧 From: info@printshop.com                                     │   │
│  │ Subject: "Special offer on business cards"                      │   │
│  │ Preview: "Get 50% off your next order..."                       │   │
│  │                                                                 │   │
│  │ [Create Lead] [Link to Existing] [Archive as Junk]              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ✅ TRIAGED (Auto-archived)                                             │
│  All emails already linked to customers are auto-removed from inbox    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Changes:**
- **Not your main view** - just for NEW stuff
- **Auto-clears** when emails get linked to leads
- **Quick triage actions** - create/link/archive
- **Goal**: Keep it at zero

---

## NAVIGATION (Lead-focused hierarchy)

```
Primary Navigation:
├─ 🏠 Dashboard (DEFAULT - the split Sales/Production view)
├─ 💼 Leads (All sales opportunities)
│  ├─ Active (34)
│  ├─ Overdue (5)
│  ├─ Stale (review needed)
│  └─ Closed/Won
├─ 🏭 Projects (All work items)
│  ├─ In Design (5)
│  ├─ Production (24)
│  ├─ Shipped (recent)
│  └─ All Projects
├─ 👥 Customers (Browse all customers)
│  ├─ Active
│  ├─ VIP
│  └─ All Customers
├─ 📧 Inbox (Triage only - badge shows count)
│  └─ Needs Triage (2)
├─ 📊 Reports
│  ├─ Sales Pipeline
│  ├─ Revenue
│  └─ Team Performance
└─ ⚙️  Settings
   ├─ Team Members
   ├─ Email Templates
   └─ Tags & Categories
```

**Key Changes:**
- **Dashboard is default** (not inbox!)
- **Inbox has badge** (only check when new emails arrive)
- **Lead/Customer views prioritized**
- **Reports for management**

---

## DATABASE SCHEMA CHANGES

### New Tables

```sql
-- Internal notes system
CREATE TABLE work_item_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_item_id UUID REFERENCES work_items(id) ON DELETE CASCADE,
  author_id UUID NOT NULL, -- user who wrote the note
  content TEXT NOT NULL,
  mentions UUID[], -- array of user IDs mentioned
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Assignment tracking
ALTER TABLE work_items
ADD COLUMN assigned_to_user_id UUID REFERENCES users(id),
ADD COLUMN assigned_at TIMESTAMP,
ADD COLUMN assigned_by_user_id UUID REFERENCES users(id);

-- Tagging system
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  color TEXT, -- hex color for badge
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE work_item_tags (
  work_item_id UUID REFERENCES work_items(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (work_item_id, tag_id)
);

-- Order value tracking (for priority sorting)
ALTER TABLE work_items
ADD COLUMN estimated_value DECIMAL(10,2),
ADD COLUMN actual_value DECIMAL(10,2);

-- Stale lead tracking
ALTER TABLE work_items
ADD COLUMN last_activity_at TIMESTAMP, -- auto-updated on any change
ADD COLUMN is_stale BOOLEAN DEFAULT FALSE, -- auto-flagged if no activity 30+ days
ADD COLUMN stale_notified_at TIMESTAMP; -- track if we sent notification
```

### Updated Logic

```sql
-- Auto-archive junk conversations
CREATE OR REPLACE FUNCTION auto_archive_junk_conversations()
RETURNS void AS $$
BEGIN
  UPDATE conversations
  SET status = 'archived'
  WHERE status = 'active'
    AND work_item_id IS NULL
    AND id IN (
      SELECT DISTINCT conversation_id
      FROM communications
      WHERE category IN ('notifications', 'promotional', 'spam')
    );
END;
$$ LANGUAGE plpgsql;

-- Auto-flag stale leads
CREATE OR REPLACE FUNCTION flag_stale_leads()
RETURNS void AS $$
BEGIN
  UPDATE work_items
  SET is_stale = TRUE
  WHERE closed_at IS NULL
    AND status IN ('new_inquiry', 'quote_sent', 'design_fee_sent')
    AND last_activity_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
```

---

## WORKFLOW EXAMPLES

### Example 1: New customer inquiry email arrives

**Before (Email-focused):**
1. Check inbox (789 conversations)
2. Find the new email in the noise
3. Read email
4. Click "Create Lead"
5. Fill form
6. Lead created
7. Go to work items page to find it

**After (Lead-focused):**
1. Notification: "New email in Inbox (1)"
2. Click Inbox badge → See 1 untriaged email
3. Preview shows: "Custom fans for June wedding"
4. Click "Create Lead" → Auto-fills from email
5. Lead created, email auto-linked
6. Inbox now empty
7. Lead appears in Dashboard under "New Inquiries"

---

### Example 2: Customer replies to existing project

**Before (Email-focused):**
1. Check Inbox Replies (mixed with junk)
2. Find customer reply
3. Read email
4. Click to open work item
5. No context about previous discussion
6. Reply to email
7. Can't add internal note

**After (Lead-focused):**
1. Notification: "Diane replied to CorazonSA"
2. Click notification → Opens Lead Detail page
3. See entire history: past emails, notes, files
4. Read recent note: "Approved for NET30 terms"
5. Reply inline with template
6. Add internal note: "Payment promised by Friday"
7. Stay on same page

---

### Example 3: Manager assigns lead to sales rep

**Before (Email-focused):**
1. No assignment system
2. Manager emails/Slacks: "Can you follow up with CorazonSA?"
3. Rep has to search for the lead
4. No record of who owns what

**After (Lead-focused):**
1. Manager opens Lead Detail
2. Click "Assign to: Sarah ▼"
3. Select Sarah from dropdown
4. Sarah gets notification
5. Lead appears in Sarah's "My Assigned Leads" view
6. Dashboard shows "Assigned: Sarah" on every view
7. History logs: "Assigned to Sarah by Timothy"

---

## PRIORITY SORTING LOGIC

Based on your answer (priority = large order value):

```typescript
// Dashboard sorting algorithm
function sortLeads(leads) {
  return leads.sort((a, b) => {
    // 1. CRITICAL: Overdue follow-ups (red alert)
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1

    // 2. HIGH: Due today
    if (a.isDueToday !== b.isDueToday) return a.isDueToday ? -1 : 1

    // 3. HIGH: Event date within 7 days (urgent)
    if (a.eventWithin7Days !== b.eventWithin7Days) return a.eventWithin7Days ? -1 : 1

    // 4. MEDIUM: Order value (your priority)
    if (a.estimatedValue !== b.estimatedValue) return b.estimatedValue - a.estimatedValue

    // 5. LOW: Most recent activity
    return b.lastActivityAt - a.lastActivityAt
  })
}
```

---

## QUICK WINS (What gets better immediately)

| Problem | Before | After |
|---------|--------|-------|
| **Finding active leads** | Search through 789 conversations | Dashboard shows 34 leads, sorted by priority |
| **Context on customer** | Just see email thread | See all: orders, files, notes, emails, history |
| **Team collaboration** | Email/Slack outside system | @mentions, assignment, private notes |
| **Junk noise** | 700+ junk conversations visible | Auto-archived, inbox shows only 0-2 untriaged |
| **Stale leads** | No visibility, fall through cracks | Auto-flagged, dedicated review queue |
| **Replying to customer** | Navigate to inbox, compose | Inline reply on Lead page with templates |
| **Knowing who owns what** | Ask around | Every lead shows assignee |
| **Priority** | Arbitrary order | Sorted by value, urgency, overdue |

---

## MIGRATION PLAN

1. ✅ Auto-archive 700+ junk conversations
2. ✅ Add notes, assignment, tags to database
3. ✅ Build new Dashboard (split Sales/Production)
4. ✅ Rebuild Lead Detail page with full context
5. ✅ Update Inbox to be triage-only
6. ✅ Update navigation (Dashboard = default)
7. ✅ Add stale lead detection
8. ✅ Integrate quick reply templates
9. ✅ Test with your real data
10. ✅ Train team on new workflow

---

## ESTIMATED IMPACT

- **Noise reduction**: 789 active conversations → ~100 (86% reduction)
- **Time to find lead**: 30-60 seconds → 5 seconds
- **Context visibility**: Emails only → Full customer history
- **Team coordination**: External (Slack/email) → In-system
- **Stale leads**: Hidden → Auto-flagged
- **Reply speed**: 3-4 clicks → 1 click (inline)

---

Does this architecture match what you envision? Any changes before I start building?
