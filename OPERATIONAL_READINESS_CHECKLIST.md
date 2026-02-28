# Operational Readiness Checklist

**Last Updated**: 2026-02-27
**Goal**: Make the system fully functional for daily business operations

---

## 🎯 Definition of "Fully Operational"

The system is ready when:
1. ✅ Sales team can manage customer relationships and pipeline
2. ✅ Team can send/receive emails from customers
3. ✅ Files can be uploaded and downloaded
4. ✅ Project statuses can be updated
5. ✅ Designers can see and work on their assigned projects
6. ✅ Shopify integration shows order data
7. ✅ All navigation works correctly
8. ✅ Mobile experience is functional

---

## 🔴 CRITICAL - Blocking Daily Operations

### 1. Email Integration
**Status**: ❌ Not functional
**Blocks**: Customer communication

**What's needed**:
- [x] Email sync from Microsoft Graph (DONE - backend exists)
- [x] Display emails in activity feeds (DONE)
- [ ] **Email composer functionality**
  - Compose new email UI
  - Send email via Microsoft Graph API
  - Attach files to emails
  - CC alternative contacts
  - Template library
  - Save as draft
- [ ] **Email buttons in UI**
  - Wire up "Email Customer" buttons on customer detail page
  - Wire up "Email Customer" buttons on project detail page
  - Pre-fill recipient from customer/contact data

**Files to modify**:
- `components/email/email-composer.tsx` (if exists, or create)
- `app/(dashboard)/customers/[id]/page.tsx` (wire up button)
- `app/(dashboard)/customers/[id]/projects/[projectId]/page.tsx` (wire up button)
- `app/api/email/send/route.ts` (create API endpoint)

---

### 2. File Upload & Download
**Status**: ❌ Not functional
**Blocks**: Design work, proof approval

**What's needed**:
- [ ] **File upload functionality**
  - Upload to Supabase Storage
  - Create file record in database
  - Show upload progress
  - Handle multiple files
  - Validate file types
  - Size limits
- [ ] **File download functionality**
  - Generate signed URLs from Supabase Storage
  - Download file when clicked
  - Preview images/PDFs in browser
- [ ] **File management**
  - Delete files
  - Rename files
  - Tag files (proof, artwork, customer-submitted, etc.)
  - Set approval status

**Files to modify**:
- `components/files/file-upload.tsx` (create)
- `components/files/file-gallery.tsx` (enhance existing)
- `app/api/files/upload/route.ts` (create)
- `app/api/files/[id]/download/route.ts` (create)

---

### 3. Status Updates
**Status**: ❌ Not functional
**Blocks**: Production tracking

**What's needed**:
- [ ] **Update Status dialog/modal**
  - Show current status
  - Select new status from dropdown
  - Add optional note about status change
  - Update project in database
  - Create activity log entry
- [ ] **Status change permissions**
  - Who can change status?
  - Validation rules (can't skip stages?)
- [ ] **Status change notifications**
  - Notify customer when shipped
  - Notify designer when needs approval

**Files to modify**:
- `components/projects/update-status-dialog.tsx` (create)
- `app/(dashboard)/customers/[id]/projects/[projectId]/page.tsx` (wire up button)
- `app/api/projects/[id]/status/route.ts` (create)

---

## 🟡 HIGH PRIORITY - Major Features

### 4. Customer List CRM Columns
**Status**: ❌ Missing key columns
**Blocks**: Sales pipeline management

**What's needed**:
- [ ] **Database migration**
  ```sql
  ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS organization_name TEXT,
  ADD COLUMN IF NOT EXISTS estimated_value NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ;
  ```
- [ ] **Update query** to fetch new fields
- [ ] **Add columns** to table: Assigned To, Company, Est. Value, Next Follow-Up
- [ ] **Make columns sortable**
- [ ] **Add column visibility toggles**

**Files to modify**:
- Create migration script in `scripts/add-crm-fields-to-customers.js`
- `app/(dashboard)/customers/page.tsx` (add columns)

---

### 5. Shopify Integration
**Status**: ⚠️ Placeholder only
**Blocks**: Order history visibility

**What's needed**:
- [ ] **Fetch orders from Shopify API**
  - Match by customer email
  - Store in database or fetch on-demand
  - Show order history
- [ ] **Display order details**
  - Order number, date, amount
  - Line items
  - Fulfillment status
  - Link to Shopify admin
- [ ] **Sync mechanism**
  - Webhook when new order created
  - Manual refresh button
  - Background sync job

**Files to modify**:
- `app/api/shopify/orders/route.ts` (create)
- `components/shopify/order-list.tsx` (create)
- `app/(dashboard)/customers/[id]/page.tsx` (wire up Shopify tab)

---

### 6. Create New Project Flow
**Status**: ⚠️ Links exist but flow incomplete
**Blocks**: Adding new projects

**What's needed**:
- [ ] **Project creation form**
  - Customer selection (if from All Projects page)
  - Customer pre-filled (if from customer page)
  - Project title/name
  - Type (custom_merch, etc.)
  - Event date
  - Quantity
  - Special requirements
  - Assigned designer
- [ ] **Form validation**
- [ ] **Create project in database**
- [ ] **Redirect to new project page**
- [ ] **Create initial activity log entry**

**Files to modify**:
- `app/(dashboard)/work-items/new/page.tsx` (enhance existing or create)
- `components/projects/project-form.tsx` (create)
- `app/api/projects/route.ts` (POST endpoint)

---

## 🟢 MEDIUM PRIORITY - Nice to Have

### 7. Designer Assignment
**Status**: ❌ Not functional
**Blocks**: Work distribution

**What's needed**:
- [ ] Assign designer dropdown in project detail
- [ ] Bulk assign in All Projects page
- [ ] Filter "My Projects" by current user
- [ ] Notifications when assigned

---

### 8. Customer Notes (Customer-level)
**Status**: ⚠️ Activity feed exists, needs enhancement
**Blocks**: Team collaboration

**What's needed**:
- [ ] Customer-level notes (separate from project notes)
- [ ] @mentions to notify team members
- [ ] Pin important notes
- [ ] Note categories/tags

---

### 9. Production Status Visual
**Status**: ❌ Not built
**Blocks**: Visual progress tracking

**What's needed**:
- [ ] Visual progress bar: Design → Proof → Approval → Production → Shipped
- [ ] Phase indicators with colors
- [ ] Event date countdown
- [ ] Days until event warning system

---

### 10. Mobile Experience
**Status**: ⚠️ Partially responsive
**Blocks**: Mobile usage

**What's needed**:
- [ ] Test all pages on mobile
- [ ] Fix touch targets < 44px
- [ ] Optimize table layouts for mobile
- [ ] Test Kanban drag & drop on mobile
- [ ] Bottom navigation functional

---

## 🔵 LOW PRIORITY - Future Enhancements

### 11. Advanced Search
- [ ] Global search across customers, projects, files
- [ ] Filters and saved searches
- [ ] Command palette (Cmd+K) already exists, needs enhancement

### 12. Notifications
- [ ] In-app notifications
- [ ] Email notifications for status changes
- [ ] Push notifications (future)

### 13. Reporting & Analytics
- [ ] Sales pipeline metrics
- [ ] Revenue tracking
- [ ] Designer productivity
- [ ] Customer lifetime value

### 14. Batch Management
- [ ] Print batching (some exists)
- [ ] Production scheduling
- [ ] Batch status tracking

### 15. Templates
- [ ] Email templates
- [ ] Project templates
- [ ] Note templates

---

## 📊 Implementation Priority Order

### Sprint 1: Core Communication & File Management (Week 1)
1. **Email composer functionality** (2-3 days)
   - Most critical for daily operations
   - Blocks customer communication
2. **File upload/download** (2-3 days)
   - Critical for design workflow
   - Blocks proof sharing

### Sprint 2: Project Management (Week 2)
3. **Status updates** (1 day)
   - Needed for production tracking
4. **Create new project flow** (1-2 days)
   - Needed to add work to system
5. **Customer list CRM columns** (1 day)
   - Database migration + UI updates

### Sprint 3: Integration & Polish (Week 3)
6. **Shopify integration** (2-3 days)
   - Order history visibility
7. **Designer assignment** (1 day)
   - Work distribution
8. **Mobile testing & fixes** (1-2 days)
   - Ensure mobile usability

### Sprint 4: Enhancements (Week 4)
9. **Production status visual** (1 day)
10. **Customer-level notes enhancement** (1 day)
11. **Testing & bug fixes** (2-3 days)
12. **Documentation & training** (1-2 days)

---

## ✅ Success Criteria

The system is "fully operational" when:

### For Sales Team
- [ ] Can view customer pipeline in Kanban
- [ ] Can drag customers between stages
- [ ] Can see all customer info (assigned to, company, value, next follow-up)
- [ ] Can click customer to see full detail
- [ ] Can send email to customer with one click
- [ ] Can create new project for customer
- [ ] Can see all projects for a customer
- [ ] Can view project details
- [ ] Can see communication history

### For Design Team
- [ ] Can see all projects assigned to them
- [ ] Can view project details and customer context
- [ ] Can upload design files
- [ ] Can see customer-submitted files
- [ ] Can update project status
- [ ] Can add notes to projects

### For Operations Team
- [ ] Can see all active projects
- [ ] Can track production status
- [ ] Can see event dates and urgency
- [ ] Can assign designers to projects
- [ ] Can batch projects for production

### For Everyone
- [ ] Mobile app is usable on phone
- [ ] Navigation is intuitive
- [ ] Pages load quickly
- [ ] No broken links or errors
- [ ] Data saves correctly

---

## 🚀 Getting Started

**Recommended first steps**:

1. Run database migration to add CRM fields to customers
2. Build email composer component
3. Wire up email buttons throughout UI
4. Build file upload component
5. Test end-to-end workflow: Create customer → Create project → Upload file → Send email → Update status

**After core features work**, move to enhancements and polish.

---

**Current Status**: System has good foundation, needs functional wiring to be fully operational.
**Estimated time to operational**: 3-4 weeks with focused development.
**Biggest blockers**: Email and file management functionality.
