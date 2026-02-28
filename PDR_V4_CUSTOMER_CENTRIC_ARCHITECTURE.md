# PDR v4: Customer-Centric Architecture

**Version**: 4.0
**Date**: 2026-02-27
**Status**: In Progress

---

## 🎯 Core Philosophy

**Sales and follow-up is about PEOPLE, not projects.**

The system must be organized around **customers** (people/organizations), with projects living as sub-items within each customer relationship. This reflects the real-world workflow where you're managing relationships with people, and those people may have multiple projects over time.

---

## 📊 Data Model & Mental Model

### Customer (Person/Organization)
- **What it is**: A persistent person or company you have a relationship with
- **Lifecycle**: Never deleted, lives forever in the system
- **Purpose**: Track the relationship, contact info, history, and all interactions
- **Can have**: Multiple projects over time (past, current, future)

### Project (Sales Opportunity / Work Item)
- **What it is**: A specific sales opportunity or work order
- **Belongs to**: One customer
- **Purpose**: Track a specific deal through design, production, and fulfillment
- **Lifecycle**: Lives under the customer, contains all project-specific details
- **Contains**:
  - Design files and proofs (specific to THIS project)
  - Production status
  - Event date and details
  - Timeline of events for THIS project
  - Communication related to THIS project
  - Custom merchandise specifications

### Key Relationships
```
Customer (Person)
├── Project 1 (PTA Fundraiser 2024)
│   ├── Design Files
│   ├── Proofs
│   ├── Timeline
│   └── Event Date: May 15, 2024
├── Project 2 (Spirit Week 2025)
│   ├── Design Files
│   ├── Proofs
│   ├── Timeline
│   └── Event Date: October 10, 2025
└── Alternative Contacts
    ├── Financial Sponsor (Jane Smith)
    └── Co-Chair (Bob Johnson)
```

---

## 🏗️ System Architecture

### 1. Customers Page (PRIMARY Sales & CRM Workspace)

**Purpose**: Manage customer relationships and sales pipeline

**View Options**:
- **List View** (default): Table of all customers with key info
- **Kanban View**: Visual pipeline of customers moving through sales stages

**Kanban Stages** (for CUSTOMERS, not projects):
1. **New Lead** - First contact, initial inquiry
2. **Contacted** - You've reached out or they've responded
3. **In Discussion** - Active conversations about their needs
4. **Quoted** - You've sent them a quote
5. **Negotiating** - Working out details, waiting for approval
6. **Won** - They've said yes and are moving forward
7. **Active Customer** - Ongoing relationship with completed/active projects
8. **Lost** - Did not move forward

**What You See on Each Card/Row**:
- Customer name and avatar
- Company/organization name
- Primary contact info (email, phone)
- Number of projects (total)
- Number of active projects
- Last contact date
- Sales stage (the Kanban column they're in)
- Next follow-up date

**Key Actions**:
- Drag customers between stages (Kanban view)
- Click customer to open full detail page
- Quick actions: Email, Call, Log Note

---

### 2. Customer Detail Page (Complete Workspace)

**URL**: `/customers/[id]`

**Purpose**:
- Complete view of customer relationship
- All projects for this customer in one place
- All communication history
- All contacts associated with this customer

**Layout**:

#### Top Section: Customer Info
- Customer name (large)
- Primary contact info (email, phone)
- Company/organization name
- Current sales stage
- Customer since date
- Quick actions: Email, Call, Create New Project

#### Tab 1: Projects (Default)
**Contains**:

**Projects List**
- Shows ALL projects for this customer
- Display as clickable cards that navigate to dedicated project page
- Each card shows summary:
  - Project title/name
  - Status badge (In Design, Awaiting Approval, In Production, Shipped, etc.)
  - Event date (if applicable)
  - Brief stats: # files, # notes, last updated
  - Type (custom_merch, etc.)
  - Created date

**Actions**:
- Click card → Navigate to `/customers/[id]/projects/[projectId]`
- "Create New Project" button in header
- Empty state with "Create First Project" button

#### Tab 2: Contacts
- Alternative Contacts Manager (already built)
- List of all contacts for this customer
- Roles: Financial Sponsor, Co-Chair, Decision Maker, Coordinator, etc.
- Each contact shows: Name, Role, Email, Phone
- Flags: "Primary contact"
- Actions: Add Contact, Edit, Delete

#### Tab 3: Activity
- Customer Activity Feed (already built)
- Timeline of all events for this customer across all projects
- Notes (customer-level, not project-specific)
- Emails sent/received
- Status changes
- File uploads
- Filter by type (Notes, Emails, Files, Status Changes)
- Add note functionality with "Email this Note" option

#### Tab 4: Shopify Orders
- All Shopify orders for this customer
- Linked automatically by email
- Order history over time
- Shows: Order number, date, amount, status
- Link to Shopify admin

#### Tab 5: Files
- ALL files across ALL projects for this customer
- Can filter by project
- Download, preview options
- Upload new files

#### Tab 2: All Communication
- Complete email history with this customer
- Includes emails to/from alternative contacts
- Gmail-style display
- Email composer at TOP
- Template library
- ChatGPT integration for drafting

#### Tab 3: Files
- ALL files across ALL projects for this customer
- Can filter by project
- Download, preview options

#### Tab 4: Shopify Orders
- All Shopify orders for this customer
- Linked automatically by email
- Order history over time

---

### 3. Project Detail Page (Dedicated Workspace)

**URL**: `/customers/[id]/projects/[projectId]`

**Purpose**:
- Focused view for working on a specific project
- Full-page workspace with all project details
- Customer context preserved via breadcrumb navigation
- Follows industry-standard CRM pattern (Salesforce, HubSpot)

**Navigation**:
- Breadcrumb header: `Customers / Customer Name / Project Title`
- Clickable breadcrumb links back to customers list and customer page
- Clean, professional navigation

**Layout**:

#### Header Section
- Project title (large)
- Status badge
- Event date (if applicable)
- Estimated value
- Assigned designer
- Quick actions: Update Status, Email Customer

#### Content Tabs

**Tab 1: Activity (Default)**
- Project-specific activity feed
- Notes (project-level)
- Emails related to this project
- File uploads
- Status changes
- Add note with "Email this Note" option
- @mentions for team collaboration
- Filter by type

**Tab 2: Files**
- All files uploaded for THIS project
- Design files, proofs, artwork
- Customer-submitted files
- Upload new files button
- Download/preview files
- File metadata: uploaded by, date, size
- File approval status

**Tab 3: Details**
- Project information
  - Type (custom_merch, etc.)
  - Status
  - Created/Updated dates
  - Event date
  - Quantity
  - Pricing details
- Production status
  - Visual progress: Design → Proof → Approval → Production → Shipped
  - Phase indicators
  - Event date countdown
- Custom merchandise specifications
- Shopify order links
- Assigned team members

**Future Tabs** (not yet built):
- Tasks/Checklist
- Invoices/Payments
- Shipping/Tracking

---

### 4. All Projects Page (Operations/Production Tracking)

**URL**: `/projects` or `/work-items`

**Purpose**:
- Operational view for designers/production team
- See what needs design work
- Track production status
- NOT for sales follow-up

**Views**:
- List view: All active projects with production status
- Filter by: Designer, Status, Event Date
- Sort by: Event Date, Last Updated, Priority

**What Shows**:
- Project title
- Customer name (with link to customer page)
- Designer assigned
- Production status
- Event date
- Files/proofs status
- Quick actions: Open (expands inline), Assign Designer

**Key Difference from Customers Page**:
- This shows PROJECTS, not customers
- For operational tracking, not relationship management
- Designers see "what do I need to work on?"
- Production team sees "what's in the queue?"

---

### 4. Navigation Structure

**Primary Navigation** (Sidebar/Bottom Nav):
1. **Dashboard** - Overview metrics
2. **Customers** ⭐ - PRIMARY sales & CRM workspace
3. **Inbox** - Email management
4. **Projects** (Operations)
   - All Projects (operational list)
   - Design Queue
   - Ready to Batch
5. **Batches** - Production batching
6. **Settings**

**Why Customers is #2**:
- It's your PRIMARY workspace
- Where you spend most time
- Sales and follow-up happen here
- Customers → Projects hierarchy is clear

---

## 🎨 Design Specifications

### Customer Kanban View
- Columns: One per sales stage
- Cards: Customer cards with avatar, name, company
- Drag & drop: Move customers between stages
- Visual style: Follow Up Boss inspiration - clean, minimal
- Mobile: Vertical scrolling columns

### Customer Detail - Project Accordions
- Closed: Show summary in single line
- Open: Expand to show full details WITHOUT navigation
- Animation: Smooth 150ms transition
- Visual hierarchy: Clear parent (customer) → child (project) relationship
- No "ugly project page" - everything inline

### Touch Targets
- All buttons: 44px minimum on mobile
- Accordion headers: Large touch area
- Expandable sections: Clear visual affordance

### Colors & Status Badges

**Sales Stages** (Customer-level):
- New Lead: Blue
- Contacted: Purple
- In Discussion: Yellow
- Quoted: Orange
- Negotiating: Orange (darker)
- Won: Green
- Lost: Red

**Production Statuses** (Project-level):
- In Design: Purple
- Awaiting Approval: Orange
- In Production: Blue
- Shipped: Green
- On Hold: Gray

---

## 🔄 Workflows

### Primary Workflow: Following Up with Customer

1. Open **Customers page**
2. Find customer in Kanban or search
3. Click customer → Opens detail page
4. See all their projects, communication, contacts
5. Send email, log call, add note
6. Update sales stage if needed
7. Move customer in Kanban if stage changed

### Secondary Workflow: Working on Project Design

1. Designer opens **All Projects** page
2. See projects assigned to them
3. Click project to expand inline
4. View customer info, upload files, update status
5. OR click customer name to see full customer context

### Tertiary Workflow: Creating New Project for Existing Customer

1. Find customer on Customers page
2. Open customer detail page
3. Click "Create New Project" button
4. Fill in project details (event date, type, requirements)
5. Project appears in customer's project list
6. Project also appears in All Projects for operations team

---

## 📋 Implementation Checklist

### Phase 1: Customer Kanban ✅ COMPLETE
- [x] Add Kanban view to Customers page
- [x] Customer cards with draggable behavior
- [x] Sales stage columns
- [x] Move customer between stages
- [x] Mobile-responsive vertical scroll

### Phase 2: Customer List View (CRM Fields)
- [ ] Add "Assigned To" column
- [ ] Add "Company" column
- [ ] Add "Est. Value" column
- [ ] Add "Next Follow-Up" column
- [ ] Add database migration for missing fields
- [ ] Make columns sortable
- [ ] Add filtering by assigned user

### Phase 3: Project Detail Page ✅ COMPLETE (Structure)
- [x] Dedicated route `/customers/[id]/projects/[projectId]`
- [x] Breadcrumb navigation with customer context
- [x] Project header with status
- [x] Activity tab with project feed
- [x] Files tab (structure)
- [x] Details tab (structure)
- [ ] Wire up "Update Status" button
- [ ] Wire up "Email Customer" button
- [ ] Build file upload functionality
- [ ] Build file download functionality
- [ ] Add production status visual indicator
- [ ] Add event date countdown

### Phase 4: Customer Detail Page Tabs
- [x] Projects tab with cards (structure)
- [x] Contacts tab (Alternative Contacts Manager)
- [x] Activity tab (Customer Activity Feed)
- [ ] Shopify Orders tab (functional)
- [ ] Files tab (cross-project aggregation)
- [ ] Wire up email composer
- [ ] Wire up "Create Project" button

### Phase 5: All Projects Operational View ✅ COMPLETE (Transformation)
- [x] Transform from "Sales Leads" to production focus
- [x] Production-focused stats
- [x] Project-centric columns
- [ ] Designer assignment functionality
- [ ] Bulk actions (assign, status update)
- [ ] Advanced filtering (by status, designer, date range)

---

## 🚀 Key Benefits

### For Sales Team
1. **Relationship-first**: Manage people, not just deals
2. **Context always available**: See all customer history in one place
3. **No lost information**: All projects for a customer visible
4. **Better follow-up**: Track relationships over time

### For Operations Team
1. **Clear production queue**: See what needs work
2. **Designer assignment**: Know who's working on what
3. **Customer context**: Easy to see customer details when needed

### For Customers
1. **Consistent experience**: Same person manages relationship
2. **Better communication**: All emails in context
3. **Professional appearance**: Organized, comprehensive system

---

## ❓ Open Questions

1. Should Kanban stages be customizable per user?
2. How many projects should show expanded by default?
3. Should "Won" customers automatically move to "Active Customer" stage?
4. What triggers should create new projects vs updating existing ones?
5. Should alternative contacts appear in email "To:" field suggestions?

---

## 📝 Documentation Updates Needed

- [ ] Update PDR v3 documents to reflect v4 changes
- [ ] Update REDESIGN_NOTES.md with customer-centric approach
- [ ] Create migration guide from project-centric to customer-centric
- [ ] Document data model in detail
- [ ] Create workflow diagrams

---

**Status**: Ready for implementation
**Next Step**: Build Phase 1 (Customer Kanban view)
