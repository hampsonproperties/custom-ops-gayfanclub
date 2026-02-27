# System Redesign Notes - v4 Customer-Centric Architecture

## Session Date: 2026-02-27

---

## 🎯 CRITICAL REALIZATION

**The fundamental misunderstanding**:
- ❌ OLD: System organized around Projects/Sales Leads
- ✅ NEW: System organized around Customers (People)

**Why this matters**:
> "I'm not following up with projects. I'm following up with CUSTOMERS."

**The core insight**:
- Sales and follow-up work happens with PEOPLE
- Projects are just deals you're doing with those people
- A customer might have multiple projects over time
- The relationship is with the PERSON, not the individual deals

---

## 🏗️ New Architecture

### Primary: Customers Page
**Purpose**: CRM and sales management

**What it should be**:
- List of PEOPLE you're selling to
- Kanban view showing CUSTOMERS moving through sales stages
- This is where you do follow-ups
- This is your main workspace

**Kanban Stages (for PEOPLE)**:
1. New Lead
2. Contacted
3. In Discussion
4. Quoted
5. Negotiating
6. Won
7. Active Customer
8. Lost

### Secondary: Customer Detail Page
**Purpose**: Complete workspace for managing one customer relationship

**What it should have**:
- Customer info at top
- **Alternative Contacts** (Financial Sponsors, Co-Chairs, Decision Makers)
- **Projects Section** with expandable accordions:
  - Click project → Expands RIGHT THERE (no navigation)
  - Shows design files, proofs, timeline, production status
  - Everything project-specific lives here
  - Each project self-contained

**Key principle**:
> "I don't know if we need the ugly product page at all if we build it into the projects within the nested customer space."

### Tertiary: All Projects Page
**Purpose**: Operations and production tracking (NOT sales)

**What it's for**:
- Ryan/Matt to see what needs design work
- Production team to track status
- See what's being worked on
- NOT for sales follow-up

**User's words**:
> "All projects should show all of the projects that are being in service and where they are in the process of being designed or whatever... other than the sales piece which is to a person, is a lot of design stuff and proofs and those types of things."

---

## 🎨 Design Direction

### Style Inspiration
**Follow Up Boss CRM** - Real estate industry standard

**Aesthetic**:
- Clean, simple, minimal
- NOT color-forward - understated
- Modern but functional
- Speed and time-saving are priorities
- Make everything as simple as possible

### Customer Page Kanban
- Drag customers between sales stages
- Visual pipeline
- Customer cards show: avatar, name, company, project count
- Mobile: vertical scrolling columns

### Customer Detail - Project Accordions
- Projects shown as expandable sections
- Click to expand → Shows everything inline
- NO separate project detail page
- Each project contains:
  - Design files specific to that project
  - Proofs for that project
  - Timeline for that project
  - Production status
  - Event date and details

**User's requirement**:
> "Each project typically has design stuff that goes along with it and its own project-specific details. That's what we want to track in projects."

---

## 🔄 Workflow Examples

### Example 1: Following Up with Customer
1. Open Customers page (Kanban view)
2. Find "Sarah Johnson" in "Quoted" column
3. Click Sarah → Opens her detail page
4. See she has 2 projects:
   - PTA Fundraiser 2024 (In Production)
   - Spirit Week 2025 (In Design)
5. Send follow-up email
6. Log note about conversation
7. Drag Sarah from "Quoted" to "Won" in Kanban

### Example 2: Designer Working on Project
1. Ryan opens All Projects page
2. Sees "PTA Fundraiser - Sarah Johnson" assigned to him
3. Clicks to expand the project
4. Uploads design proof
5. Updates status to "Awaiting Approval"
6. Sales person (Tim) gets notified
7. Tim opens Sarah's customer page
8. Expands the PTA Fundraiser project
9. Reviews proof, sends to customer

### Example 3: Returning Customer
1. Sarah contacts Tim about a new event in 2026
2. Tim opens Sarah's customer page
3. Sees her past projects (2024, 2025)
4. Clicks "Create New Project"
5. New project appears in Sarah's project list
6. Also appears in All Projects for operations

---

## 📊 Data Structure

```
customers/
├── [customer_id]/
│   ├── Contact Info
│   │   ├── Name
│   │   ├── Email
│   │   ├── Phone
│   │   └── Company
│   ├── Alternative Contacts
│   │   ├── Financial Sponsor
│   │   ├── Co-Chair
│   │   └── Decision Maker
│   ├── Sales Stage (Kanban position)
│   ├── Customer Notes (relationship-level)
│   └── Projects/
│       ├── Project 1 (PTA Fundraiser 2024)
│       │   ├── Design Files
│       │   ├── Proofs
│       │   ├── Timeline
│       │   ├── Production Status
│       │   └── Event Date
│       └── Project 2 (Spirit Week 2025)
│           ├── Design Files
│           ├── Proofs
│           ├── Timeline
│           ├── Production Status
│           └── Event Date
```

---

## 🎯 Key Requirements

### Must Have
1. ✅ Customer Kanban view (sales pipeline)
2. ✅ Customer detail page as primary workspace
3. ✅ Project accordions that expand inline
4. ✅ Alternative contacts manager
5. ✅ Project-specific files and proofs
6. ✅ Project-specific timelines
7. ✅ Production status tracking per project
8. ⚠️ Remove separate project detail page

### Nice to Have
- Template library for emails
- ChatGPT integration for drafting
- Batch actions on customers
- Advanced filtering

---

## 🚫 What NOT to Do

1. ❌ Don't organize around projects as primary entity
2. ❌ Don't make users navigate away from customer page to see project details
3. ❌ Don't keep the "ugly project page"
4. ❌ Don't lose the relationship context when viewing projects
5. ❌ Don't make "All Projects" about sales follow-up

---

## ✅ What to Keep

1. ✅ Alternative contacts functionality (already built)
2. ✅ Design files and proofs system
3. ✅ Timeline/activity logging
4. ✅ Email system
5. ✅ Shopify integration
6. ✅ Production status tracking

---

## 📝 Implementation Notes

### Phase 1: Customers Page Kanban
- Add Kanban view toggle to existing customers page
- Drag and drop between stages
- Mobile responsive vertical scroll
- Save stage changes to database

### Phase 2: Customer Detail Refactor
- Keep header section (contact info, alternative contacts)
- Replace project cards with accordions
- Build expandable sections with full project details
- Move all project functionality inline

### Phase 3: Remove Project Detail Page
- Archive `/work-items/[id]/page.tsx`
- Ensure no links point to it
- All functionality moved to customer page accordions

### Phase 4: All Projects Simplification
- Focus on operational tracking
- Designer assignment
- Production queue management
- Link to customer page for full context

---

## 💬 User Quotes (Key Insights)

> "I'm not typically following up with projects. I'm following up with customers."

> "All projects should show all the projects that we're actively working on, but that's not necessarily what I'm selling to. I'm selling to leads and customers."

> "I don't know if we need the ugly product page at all if we build it into the projects within the nested customer space."

> "Each project typically has design stuff that goes along with it and its own project-specific details. That's what we want to track in projects and make sure that we're moving them through to actual production."

---

## 🎨 UI/UX Principles

1. **Customer-first hierarchy**: Always show customer context
2. **Inline expansion**: Avoid navigation when possible
3. **Project independence**: Each project has its own files, timeline, status
4. **Clear visual hierarchy**: Parent (customer) → Child (project) relationship obvious
5. **Operational clarity**: Separate sales workspace from operations workspace

---

**Status**: Architecture defined, ready for implementation
**Next**: Build Customer Kanban view
