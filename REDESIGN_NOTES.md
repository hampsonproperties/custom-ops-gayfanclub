# Work Items Detail Page Redesign

## Session Date: 2026-02-27

### Overview
Redesigning the sales leads system (list + detail pages) to better align with the team's business workflow and needs.

### Design Direction
**Style Inspiration:** Follow Up Boss (real estate CRM)
**Aesthetic:**
- Clean, simple, minimal
- NOT color-forward - understated
- Modern but functional
- Keep current color scheme
**Priority:** Speed and time-saving - optimize for efficiency over decoration
**Goal:** Make the process as simple as possible, save maximum time

---

## Discussion Notes

### 1. Sales Lead Page (Work Items List View)

**Current Issues:**
- Large box layout is taking up too much space
- Not enough key information visible at a glance
- Hard to scan through leads quickly

**Desired Changes:**
- Switch from card/box layout to **table-style layout**
- More compact, scannable view

**Top Section (KEEP AS-IS):**
- Active leads counter
- Pipeline conversion metrics
- Filters

**Bottom Section (REDESIGN TO TABLE):**

**Columns to Include:**
- Name
- Company name (if applicable)
- Email
- Phone number
- Quick actions

**Questions to Clarify:**
- Column order preference?
- Should status be visible in table?
- Show estimated value?
- Show next follow-up date?
- What specific quick actions? (Email, Change Status, View Details, etc.)
- Quick action format preference? (buttons, dropdown, icons)
- Should columns be sortable?
- Need any tags visible?
- Visual indicators for urgent/overdue items?

**Reference Screenshots Provided:**
1. Widgetz.io style - Simple table: NAME, LEAD SCORE, STAGE, LAST CONTACTED, filters on right
2. noCRM.io - Kanban pipeline view (likely not the desired approach)
3. Clean sectioned view - "New leads" / "Qualified leads" groups, columns: Name, Owner (avatar), Status (badge), Email, Title, Company, + action
4. Comprehensive table - NAME (with avatar + status badge), COMPANY, LEAD SCORE, PHONE, AREA, CREATED DATE, TAGS, ACTIONS (phone/message/more icons), robust right-side filtering

**Design Decisions Made:**

**Preferred Layout:** Screenshot 4 (8:01:54) - Comprehensive table with all info

**Confirmed Columns:**
1. Checkbox (for bulk actions - TBD)
2. Avatar + Name (with status badge underneath)
3. Company Name
4. Phone Number (displayed, not clickable to call - no Twilio integration)
5. Email (displayed)
6. Estimated Value (important!)
7. Next Follow-Up Date (TBD - need to figure out how to set this)
8. Actions: Email icon (should use internal email system, NOT external popup)

**Status System:**
- Statuses are VERY important
- Need to be editable on-the-fly (quick edit from table)
- Want BOTH table view AND Kanban/pipeline view to track through phases
- Statuses should reflect custom order workflow

**Business Process (Custom Orders):**
1. Lead comes in
2. Contact them / discuss needs
3. Quote the order
4. Wait for decision maker (manager/board/school approval) - often sits in limbo here
5. Either moves forward or doesn't

**Status Flow (FINAL):**

**LEADS SYSTEM** (Sales Pipeline):
1. New Lead
2. Contacted
3. In Discussion
4. Quoted
5. Awaiting Approval (waiting on manager/board/school)
6. **Won** (they said yes, ready to order)
7. **Lost** (didn't move forward)

**Once actual order is placed** → Converts to **WORK ITEM** (production/fulfillment system)

**CRITICAL INSIGHT - Data Model:**

**Lead = PERSON/COMPANY** (persistent customer record)
- Contains: name, email, company, phone, etc.
- Persists over time, never deleted
- Can have MULTIPLE projects/orders

**Project = INDIVIDUAL SALES OPPORTUNITY** (many per lead)
- Each project has its own status in the pipeline
- One person can have multiple active projects simultaneously
- Status flow: New Lead → Contacted → In Discussion → Quoted → Awaiting Approval → Won
- When won/ordered → Converts to Work Item

**Work Item = ORDER FULFILLMENT**
- Linked to a project
- Linked to Shopify order(s) automatically by email matching
- One lead can have multiple work items over the years

**Key Points:**
- STATUS belongs to PROJECT, not to lead/person
- Same person can appear multiple times in list if they have multiple active projects
- Need to see past orders/projects under each lead
- If customer contacts again for new order = NEW PROJECT under same lead
- Shopify orders auto-link by email to projects/work items
- Want to track all Shopify orders per customer for future outreach

**Conversion & Shopify Integration:**
- Shopify orders auto-link to projects/work items by matching email
- Multiple orders per customer over time
- When project is Won + customer pays → Converts to Work Item (design/production)
- Project STAYS VISIBLE in sales leads as "In Design" or similar status
- Sales person needs visibility that designer has it
- Designer needs to see it in their own section/view

---

## LEADS PAGE (Projects List) - CONFIRMED

**Structure:**
- ✅ One row per PROJECT (not per person)
- ✅ Same person can have multiple rows if multiple active projects
- ✅ Table view + Pipeline/Kanban view (toggle between)

---

## LEAD DETAIL PAGE (Person Record)

**CURRENT STATE:**
Exists at: `/app/(dashboard)/work-items/[id]/page.tsx`

**Current Structure:**
- **Header Section:**
  - Customer name (large)
  - Email, phone, company below name
  - Estimated value (top right)
  - Status badge + Next follow-up + Event date + Assigned to
  - Shopify order badges (Design Fee Paid, Production Paid)
  - Action buttons: Email (opens composer), Update Status, Invoice

- **Tabs:**
  1. **Activity (Timeline)** - Default tab
     - Shows timeline events (emails, status changes, notes, file uploads)
     - "View full email" button DOESN'T WORK ❌
     - Email composer at BOTTOM ❌ (user wants at TOP)
     - Internal Notes section

  2. **Details**
     - Work item type, source, created date, last activity
     - Address field
     - Assignment manager
     - Value manager
     - Tag manager
     - Customer details editor
     - Alternate emails manager ✅

  3. **Files**
     - Upload/download design files
     - Shows file kind, name

  4. **Shopify Orders**
     - Shows linked Shopify orders

**WHAT EXISTS & WORKS:**
✅ Contact information (name, email, phone, company)
✅ Alternate emails manager
✅ Status tracking
✅ Assignment system
✅ Tags
✅ Files upload/download
✅ Shopify order linking
✅ Email composer component exists
✅ Timeline/activity log exists

**WHAT NEEDS IMPROVEMENT:**
❌ "View full email" button doesn't work - needs to show full email content
❌ Email composer at bottom - needs to move to TOP
❌ Email display not Gmail-like - needs polish
❌ No template library integration
❌ No AI/ChatGPT integration
❌ Can't see all projects for this person (if they have multiple)
❌ No priority inbox concept implemented

**USER REQUIREMENTS:**
- Email composer at TOP of activity feed
- "View full email" must work and show full HTML email properly
- Gmail-like feel - sexy, easy, polished
- Template library for replies
- PDF attachment library
- ChatGPT integration for:
  - Drafting responses
  - Synopsis of "what's happening"
  - Suggestions for "what's next"
- See all projects for this customer (past + current)
- Priority inbox showing only leads' emails

---

## EMAIL SYSTEM REQUIREMENTS (CRITICAL)

**Must-Have Features:**
- Feel like Gmail - sexy, easy, built-in
- Proper email display (HTML rendering)
- Reply functionality with template library
- Attach PDFs and reusable files
- Template library for common responses
- File/attachment library for frequently used PDFs

**AI Integration:**
- ChatGPT integration for drafting/improving responses
- ChatGPT synopsis of "what's happening" on the lead record
- ChatGPT suggestions for "what's next"

**Email Organization:**
- See all emails between team and customer
- Include emails to/from any associated contacts
- Needs to be really organized and easy to follow

---

## PROJECT WORKFLOW & HANDOFF (NEEDS CLARIFICATION)

**Current Understanding:**

**SALES PHASE:**
New Lead → Contacted → In Discussion → Quoted → Awaiting Approval → Won

**After Win + Payment:**
- Project converts to Work Item (design work)
- Status becomes "In Design" or similar
- Stays visible in sales leads (sales person can see designer has it)
- Also appears in designer's section/view

**Design Phase:**
- Designer works on project
- When finished → Goes back to sales person for review
- Sales person reviews → Sends proof to customer
- Customer approves → Then what?

**PROJECT LIFECYCLE - CLARIFIED:**

**Sales Owns Everything** - Sales person is the project manager for entire lifecycle

**Full Lifecycle:**
1. **Sales Phase:** New Lead → Contacted → In Discussion → Quoted → Awaiting Approval → Won
2. **Customer pays** → Project stays in sales leads but visible status changes
3. **Design Phase:** Designer works on it (may email customer directly, but sales sees everything)
4. **Review Phase:** Designer finished → Sales person reviews
5. **Proofing Phase:** Sales sends proof to customer → Customer approves
6. **Production Phase:** Goes to batch system
7. **Manufacturing:** Gets tracking number from manufacturer
8. **Shipping:** Shipped in Shopify
9. **Complete:** Only when shipped in Shopify is project truly complete

**Key Points:**
- Sales sees ALL emails (even designer→customer emails)
- Designer may need their own view of projects assigned to them
- Project stays visible throughout entire lifecycle
- Multiple statuses/phases after "Won"

**Questions Still to Clarify:**
A. Do designers need a separate page/view for projects assigned to them?
B. Should statuses after "Won" be substatus or main status? (In Design, In Review, Proofing, In Production, Manufacturing, Shipped)
C. Where are email templates/PDFs stored currently?
D. Priority order for AI features?

**View System:**
- TWO SEPARATE VIEWS on the same page (toggle between them)
- View 1: **Table View** (default) - Comprehensive table with all columns
- View 2: **Pipeline View** - Kanban board showing cards organized by status columns
- Both views show same filtered data
- Need view toggle UI at top of page

**Questions Still to Answer:**
- Confirm/adjust status flow
- How to set/manage follow-up dates?
- How to edit status in table view (click badge for dropdown?)
- Email icon behavior (modal composer vs navigate to detail page?)
- Exact column order preference
- What info shows on cards in Pipeline view?

