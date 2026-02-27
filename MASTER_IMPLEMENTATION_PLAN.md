# Master Implementation Plan - Custom Ops PDR v3 Complete

**Created**: 2026-02-27
**Status**: Ready to Execute
**Approach**: One phase at a time, complete and test before moving forward

---

## 📊 Overall Status

- **Database**: ✅ 100% Complete
- **Navigation**: ✅ 100% Complete (desktop + mobile)
- **Core Features**: ⚠️ 40% Complete
- **Sales Pipeline UX**: ❌ 0% Complete (HIGHEST PRIORITY)
- **AI Features**: ❌ 0% Complete
- **Polish & Design**: ⚠️ 60% Complete

**Estimated Total**: 3-4 weeks to full production-ready

---

## 🎯 Phase 1: Sales Pipeline Complete (Week 1) - START HERE

**Goal**: Make work items (projects) list the best sales pipeline tool possible

### **Day 1-2: Table View Redesign** ⭐ CRITICAL

**Requirement**: REDESIGN_NOTES.md Screenshot 4 layout

**File**: `/app/(dashboard)/work-items/page.tsx`

**Build exactly this:**

| ☐ | Avatar + Name<br>(status badge) | Company | Phone | Email | Est. Value | Next Follow-Up | 📧 |
|---|--------------------------------|---------|-------|-------|------------|---------------|---|

**Specific features:**
- [ ] Checkbox column for bulk actions
- [ ] Avatar + Name column with status badge underneath
- [ ] Company Name column
- [ ] Phone Number column (display only)
- [ ] Email column (display)
- [ ] **Estimated Value** column (user said "important!")
- [ ] **Next Follow-Up Date** column
- [ ] Email icon column (internal email system)
- [ ] Status badge is **editable inline** (click → dropdown → change status)
- [ ] All columns **sortable** (click header to sort)
- [ ] Make email clickable → opens composer
- [ ] Make phone clickable → shows dial option (no Twilio integration)
- [ ] Bulk selection works (select multiple, then bulk action)

**Status flow** (from REDESIGN_NOTES.md):
1. New Lead
2. Contacted
3. In Discussion
4. Quoted
5. Awaiting Approval
6. Won
7. Lost

**Test checklist:**
- [ ] Sort by each column works
- [ ] Click status badge → dropdown appears → change status
- [ ] Click email → composer opens
- [ ] Select multiple rows → bulk actions available
- [ ] Mobile: table converts to cards (already done)
- [ ] Search and filters work

---

### **Day 3-4: Pipeline/Kanban View** ⭐ BUSINESS CRITICAL

**Requirement**: REDESIGN_NOTES.md "Want BOTH table view AND Kanban/pipeline view"

**File**: Create `/components/work-items/kanban-view.tsx` + integrate

**Build this:**

```
┌─────────────┬─────────────┬──────────────┬─────────┬───────────────┬─────┬──────┐
│  New Lead   │  Contacted  │ In Discussion│ Quoted  │   Awaiting    │ Won │ Lost │
│     (3)     │     (5)     │     (2)      │   (4)   │   Approval    │ (1) │ (2)  │
│             │             │              │         │     (3)       │     │      │
├─────────────┼─────────────┼──────────────┼─────────┼───────────────┼─────┼──────┤
│ [Card]      │ [Card]      │ [Card]       │ [Card]  │ [Card]        │     │      │
│ Avatar      │ Avatar      │ Avatar       │ Avatar  │ Avatar        │     │      │
│ Name        │ Name        │ Name         │ Name    │ Name          │     │      │
│ Company     │ Company     │ Company      │ Company │ Company       │     │      │
│ $5,000      │ $3,000      │ $8,000       │ $2,500  │ $10,000       │     │      │
│ Follow: 2d  │ Follow: 5d  │ Follow: 1d   │ Follow  │ Follow: 7d    │     │      │
│             │             │              │         │               │     │      │
│ [Card]      │ [Card]      │              │ [Card]  │ [Card]        │     │      │
│ ...         │ ...         │              │ ...     │ ...           │     │      │
└─────────────┴─────────────┴──────────────┴─────────┴───────────────┴─────┴──────┘
```

**Features to build:**
- [ ] 7 status columns (New Lead → Won/Lost)
- [ ] Each column shows count in header
- [ ] Cards show: Avatar, Name, Company, Est Value, Next Follow-Up
- [ ] **Drag card between columns** = change status
- [ ] **View toggle** at top: [Table View] [Pipeline View]
- [ ] Persist user's view preference (localStorage)
- [ ] Mobile: Horizontal scroll or stacked view
- [ ] Color-coded columns (optional but nice)
- [ ] Column totals (sum of estimated values)

**Card interactions:**
- [ ] Click card → Go to work item detail page
- [ ] Hover shows quick preview
- [ ] Drag smoothly with animation (150ms)

**Test checklist:**
- [ ] Drag lead from "New Lead" to "Contacted" → status updates
- [ ] Toggle between Table/Pipeline views works
- [ ] Refresh page → remembers last view
- [ ] Mobile: can scroll/stack to see all columns
- [ ] Column counts accurate
- [ ] Cards show correct info

---

### **Day 5: Customer Integration** ⭐ DATA INTEGRITY

**Requirement**: REDESIGN_NOTES.md "Need to see past orders/projects under each lead"

**Files**:
- `/app/(dashboard)/customers/[id]/page.tsx` - Customer detail
- `/app/(dashboard)/work-items/page.tsx` - Add customer linking
- `/app/(dashboard)/work-items/[id]/page.tsx` - Show customer prominently

**Customer Detail Page (`/customers/[id]`):**
- [ ] Query all work_items where customer_id = this customer
- [ ] Display projects in "Projects" tab
- [ ] Show: Project Title, Status, Created Date, Value, Last Activity
- [ ] Click project → Go to work item detail page
- [ ] "New Project" button → Create work item for this customer
- [ ] Fix project count (currently showing 0 for everyone)

**Work Items List Page:**
- [ ] Customer name clickable → Go to customer detail
- [ ] Show "(3 projects)" next to customer name if multiple
- [ ] Same customer can appear multiple times (one row per project)

**Work Item Detail Page:**
- [ ] Show customer info prominently at top
- [ ] "View Customer Profile" link
- [ ] "View All Projects for [Customer Name]" link

**Test checklist:**
- [ ] Customer detail shows all their projects
- [ ] Can create new project for existing customer
- [ ] Work items list shows customer links
- [ ] Project detail links back to customer
- [ ] Project count accurate on customer list

---

### **Day 6: AI Integration** ⭐ IMPORTANT FEATURE

**Requirement**: REDESIGN_NOTES.md "ChatGPT integration for drafting/improving responses"

**Files**:
- Create `/lib/ai/openai-client.ts`
- Create `/app/api/ai/draft-reply/route.ts`
- Create `/app/api/ai/summarize/route.ts`
- Create `/app/api/ai/extract-info/route.ts`
- Update email composer components
- Update work item detail page

**Email Composer AI Features:**
- [ ] "Draft Reply" button → AI writes response based on thread
- [ ] "Improve Draft" button → AI polishes what you wrote
- [ ] "Change Tone" dropdown → Professional, Friendly, Brief
- [ ] Loading state while AI generates
- [ ] Can edit AI response before sending

**Work Item Detail AI Features:**
- [ ] "What's Happening?" section → AI synopsis of lead status
- [ ] "What's Next?" section → AI suggestions for follow-up
- [ ] "Extract Info" button → Pull company/value from emails into fields
- [ ] AI suggestions update when new emails arrive

**Backend Implementation:**
- [ ] OpenAI API client setup (use GPT-4 or GPT-3.5-turbo)
- [ ] API routes for each AI feature
- [ ] Prompt engineering for good results
- [ ] Error handling and rate limiting
- [ ] Cost tracking (optional)

**Alternative: Placeholders First**
If you want to defer backend:
- [ ] Create UI buttons with "Coming Soon" tooltips
- [ ] Wire to dummy functions
- [ ] Add real AI in Phase 2

**Test checklist:**
- [ ] Draft Reply generates relevant response
- [ ] Synopsis accurately describes lead status
- [ ] Extract Info pulls data correctly
- [ ] AI suggestions are helpful
- [ ] Error handling works

---

### **Day 7: Tagging System** ⭐ ORGANIZATION

**Requirement**: User said tagging is important

**Files**:
- Database: Verify `work_items` has tags support
- Create `/components/work-items/tag-input.tsx`
- Update work items list and detail pages

**Features to build:**
- [ ] Multi-select tag input component
- [ ] Tag autocomplete (existing tags)
- [ ] Create new tags on the fly
- [ ] Color-coded tags (optional)
- [ ] Tag categories: Priority, Source, Industry, etc.

**Work Items List:**
- [ ] Show tags on each row (chips/badges)
- [ ] Filter by tag (multi-select dropdown)
- [ ] "Tagged" vs "Untagged" filter

**Work Item Detail:**
- [ ] Tag manager section
- [ ] Add/remove tags easily
- [ ] Tags show in header area

**Pipeline View:**
- [ ] Show tags on cards
- [ ] Filter pipeline by tags

**Test checklist:**
- [ ] Add tags to lead
- [ ] Filter list by tag
- [ ] Create new tags
- [ ] Tags appear in all views
- [ ] Remove tags works

---

## ✅ End of Phase 1 (Week 1) Deliverables

By end of Week 1, you will have:

✅ **Comprehensive sales leads table** with all required columns
✅ **Visual Pipeline/Kanban board** with drag-and-drop
✅ **Customer ↔ Project integration** working properly
✅ **AI features** (full backend or placeholders)
✅ **Tagging system** for organization
✅ **Inline status editing** from table
✅ **Sortable columns** and bulk actions

**This is ONE complete area** that you can test, use, and get real feedback on before moving forward.

---

## 🎯 Phase 2: Email & Communication (Week 2)

**Goal**: Make email feel like Gmail, templates easy to use

### **Day 1: Email Composer Position Fix** ⭐ QUICK WIN

**Requirement**: REDESIGN_NOTES.md "Email composer at BOTTOM ❌ (user wants at TOP)"

**File**: `/app/(dashboard)/work-items/[id]/page.tsx`

**Tasks:**
- [ ] Move email composer to **TOP** of Activity tab
- [ ] Fix "View full email" button (currently broken)
- [ ] Improve email HTML rendering
- [ ] Add thread collapse/expand
- [ ] Polish styling to be Gmail-like

**Test checklist:**
- [ ] Composer is first thing in Activity tab
- [ ] "View full email" shows full content
- [ ] Threads collapse/expand smoothly
- [ ] Looks and feels like Gmail

---

### **Day 2-3: Template Library UI** ⭐ HIGH VALUE

**Requirement**: REDESIGN_NOTES.md "Template library for replies"

**Files**:
- Create `/components/email/template-selector.tsx`
- Update email composer to integrate templates
- Database: `templates` table already exists

**Features to build:**
- [ ] Template selector dropdown in composer
- [ ] List all active templates
- [ ] Template preview on hover
- [ ] Insert template with one click
- [ ] Merge fields replacement ({{customer_name}}, {{company}}, etc.)
- [ ] Edit template before sending
- [ ] "Save as Template" button in composer

**Template Management:**
- [ ] Create new templates
- [ ] Edit existing templates
- [ ] Deactivate templates
- [ ] Template categories/tags

**Test checklist:**
- [ ] Select template → inserts into composer
- [ ] Merge fields replaced correctly
- [ ] Can edit before sending
- [ ] Save new templates works
- [ ] Template preview accurate

---

### **Day 4-5: File Attachment Library** ⭐ PRODUCTIVITY

**Requirement**: REDESIGN_NOTES.md "PDF attachment library"

**Files**:
- Create `/components/email/attachment-library.tsx`
- Create storage system for reusable files
- Integrate into email composer

**Features to build:**
- [ ] Library of frequently-used PDFs/files
- [ ] Upload reusable attachments
- [ ] Categorize attachments (Quotes, Policies, Forms, etc.)
- [ ] Quick insert into email
- [ ] Search attachments
- [ ] Preview attachments

**Email Composer Integration:**
- [ ] "Attach from Library" button
- [ ] Browse library in modal
- [ ] Select multiple files
- [ ] Also allow direct upload

**Test checklist:**
- [ ] Upload file to library
- [ ] Attach from library to email
- [ ] Search finds files
- [ ] Categories work
- [ ] Preview works

---

### **Day 6: @Mentions System** ⭐ COLLABORATION

**Requirement**: User said this is important

**Files**:
- Create database tables: `mentions`
- Create `/components/mentions/mention-autocomplete.tsx`
- Integrate into notes/comments

**Features to build:**
- [ ] @mention autocomplete in text fields
- [ ] Tag team members by name
- [ ] Mention notifications
- [ ] Badge showing unread mentions
- [ ] "My Mentions" view in inbox

**Where @mentions work:**
- [ ] Internal notes on work items
- [ ] Comments on projects
- [ ] Email notes (internal only)

**Test checklist:**
- [ ] Type @ → shows team members
- [ ] Select person → tagged
- [ ] They get notification
- [ ] Mentions view shows all
- [ ] Mark as read works

---

### **Day 7: Priority Inbox Concept** ⚠️ OPTIONAL

**Requirement**: REDESIGN_NOTES.md mentions priority inbox

**Features:**
- [ ] Smart filtering (overdue, VIP customers, high value)
- [ ] Auto-assign priority levels
- [ ] "Priority Inbox" view
- [ ] Manual priority override

**Skip if time is short** - this is nice-to-have

---

## ✅ End of Phase 2 (Week 2) Deliverables

✅ **Email composer at top** with working "view full email"
✅ **Template library** with one-click insert
✅ **File attachment library** for reusable PDFs
✅ **@Mentions system** for team collaboration
✅ **Gmail-like email UX** with polish

---

## 🎯 Phase 3: Tasks & Collaboration (Week 3)

**Goal**: Enable team task management and coordination

### **Day 1-3: Tasks System** ⭐ BIG FEATURE

**Requirement**: User said tasks are important

**Database tables to create:**
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES users(id),
  due_date TIMESTAMPTZ,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  work_item_id UUID REFERENCES work_items(id),
  customer_id UUID REFERENCES customers(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Features to build:**
- [ ] Task list view (my tasks, team tasks)
- [ ] Task creation form/modal
- [ ] Task assignment to team members
- [ ] Due date picker
- [ ] Task status tracking
- [ ] Task completion
- [ ] Tasks on work item detail page
- [ ] "Create Task" quick action

**Test checklist:**
- [ ] Create task assigned to team member
- [ ] They see it in their task list
- [ ] Mark complete
- [ ] Tasks show on work item
- [ ] Overdue tasks highlighted

---

### **Day 4-5: Batch Detail Page & Drip Timeline** ⭐ WORKFLOW

**Requirement**: PDR v3 batch drip email system

**File**: Create `/app/(dashboard)/batches/[id]/page.tsx`

**Features to build:**
- [ ] Batch detail page
- [ ] List all work items in batch
- [ ] Batch metadata (name, date, status)
- [ ] **Drip email timeline** visualization
- [ ] Show scheduled vs sent emails
- [ ] Color code email status (pending, sent, failed)
- [ ] Manual trigger button for emails
- [ ] Tracking number input
- [ ] Mark batch shipped

**Drip Timeline Visual:**
```
Day 0: Batch Created ✅
Day 1: "Order Received" email → Sent ✅
Day 3: "In Production" email → Sent ✅
Day 7: "Shipping Soon" email → Pending ⏳
Day 10: "Shipped" email → Pending ⏳
```

**Test checklist:**
- [ ] View batch detail
- [ ] See all items in batch
- [ ] Timeline shows scheduled emails
- [ ] Can manually trigger email
- [ ] Timeline updates when sent

---

### **Day 6-7: Polish & Bug Fixes**

**Tasks:**
- [ ] Fix any bugs found in Phase 1 or 2
- [ ] Improve loading states
- [ ] Add empty states with helpful messages
- [ ] Test all workflows end-to-end
- [ ] Get user feedback
- [ ] Make adjustments

---

## ✅ End of Phase 3 (Week 3) Deliverables

✅ **Tasks system** for team coordination
✅ **Batch detail page** with drip email timeline
✅ **Bug fixes** and polish
✅ **User testing** and feedback incorporated

---

## 🎯 Phase 4: Design System & Final Polish (Week 4)

**Goal**: Make everything look and feel consistent

### **Design System Fixes**

- [ ] Update primary pink to #FF0080 (currently #E91E63)
- [ ] Standardize status badge colors
- [ ] Document color system
- [ ] Fix typography inconsistencies (h1, h2, h3 sizes)
- [ ] Standardize button variants usage
- [ ] Add 150ms transitions everywhere
- [ ] Create component usage guide

### **UX Polish**

- [ ] Add loading skeletons to all list pages
- [ ] Improve empty states (helpful messages + actions)
- [ ] Add error boundaries
- [ ] Retry functionality for failed requests
- [ ] Smooth animations everywhere
- [ ] Test on mobile devices
- [ ] Fix any responsive issues

### **Documentation**

- [ ] Update PDR v3 with completed features
- [ ] Create user guide
- [ ] Document workflows
- [ ] Video walkthrough of key features

---

## ✅ End of Phase 4 (Week 4) - PRODUCTION READY

✅ **Complete PDR v3 implementation**
✅ **Polished design system**
✅ **Comprehensive documentation**
✅ **Tested on all devices**
✅ **Ready for production use**

---

## 🚨 Critical Items (Must Not Forget)

From your requirements and audit:

### **From REDESIGN_NOTES.md:**
1. ✅ Sales leads table (Screenshot 4 layout)
2. ✅ Pipeline/Kanban view toggle
3. ✅ Email composer at TOP (not bottom)
4. ✅ Template library
5. ✅ AI integration (Draft Reply, Synopsis, Suggestions)
6. ✅ Customer → Projects relationship
7. ✅ Status inline editing
8. ✅ Sortable columns

### **From User Requirements:**
1. ✅ AI features (specifically mentioned as important)
2. ✅ Tagging system (specifically mentioned as important)
3. ✅ @Mentions system (specifically mentioned as important)
4. ✅ Tasks system (mentioned as important)

### **From Audit Report:**
1. ✅ Fix primary pink color #FF0080
2. ✅ Batch detail page
3. ✅ Template library UI
4. ✅ Loading skeletons
5. ✅ Empty states
6. ✅ 150ms transitions

---

## 📊 Progress Tracking

**Week 1 (Sales Pipeline):**
- [ ] Day 1-2: Table redesign
- [ ] Day 3-4: Kanban view
- [ ] Day 5: Customer integration
- [ ] Day 6: AI features
- [ ] Day 7: Tagging

**Week 2 (Email):**
- [ ] Day 1: Composer position
- [ ] Day 2-3: Template library
- [ ] Day 4-5: Attachment library
- [ ] Day 6: @Mentions
- [ ] Day 7: Priority inbox (optional)

**Week 3 (Collaboration):**
- [ ] Day 1-3: Tasks system
- [ ] Day 4-5: Batch detail
- [ ] Day 6-7: Polish & bugs

**Week 4 (Polish):**
- [ ] Design system fixes
- [ ] UX polish
- [ ] Documentation
- [ ] Testing

---

## 🎯 Next Action

**Start Phase 1, Day 1: Table Redesign**

This is the highest impact item that will immediately improve your sales workflow.

Ready to begin?
