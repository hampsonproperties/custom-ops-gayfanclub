# PDR v4 Alignment Audit & Action Plan

**Date**: 2026-02-27
**Status**: CRITICAL - Major misalignment found

---

## 🔴 Critical Issues Found

### 1. Customers List View - Missing Key Sales Columns

**Current State**:
- Shows: Customer Name, Email, Phone, Project Count, Last Contact, Shopify Status
- Missing: **Assigned To, Company, Est. Value, Next Follow-Up** (all required per PDR v4)

**PDR v4 Requirement** (Section 1: Customers Page):
> What You See on Each Card/Row:
> - Customer name and avatar
> - Company/organization name ✅
> - Primary contact info (email, phone) ✅
> - Number of projects (total) ✅
> - Number of active projects ❌
> - Last contact date ✅
> - Sales stage (the Kanban column they're in) ❌
> - Next follow-up date ❌

**User Request**: Add these columns to customer list:
- Name ✅ (have)
- **Assigned To** ❌ (missing)
- **Company** ❌ (missing from table, exists in DB)
- Email ✅ (have)
- Phone ✅ (have)
- **Est. Value** ❌ (missing)
- **Next Follow-Up** ❌ (missing)
- Actions ✅ (have)

**Impact**: HIGH - Customers page is PRIMARY workspace but missing key CRM fields

---

### 2. All Projects Page - Incorrectly Sales-Focused

**Current State** (`/work-items`):
```
Title: "Sales Leads"
Subtitle: "Manage your customer projects and opportunities"
Stats: Active Leads, Pipeline Value, Conversion Rate
Filters: My Leads / All Leads
Columns: Name, Assigned To, Company, Email, Phone, Est. Value, Next Follow-Up
```

**PDR v4 Requirement** (Section 3: All Projects Page):
> **Purpose**:
> - Operational view for designers/production team
> - See what needs design work
> - Track production status
> - NOT for sales follow-up

> **What Shows**:
> - Project title
> - Customer name (with link to customer page)
> - Designer assigned
> - Production status
> - Event date
> - Files/proofs status

**Impact**: HIGH - Confusing sales with operations, designers can't see what they need to work on

---

### 3. Customify Orders Page - Not Loading

**Current State**: Page exists at `/customify-orders` but user reports it's broken

**Query**: Fetches `work_items` where `type = 'customify_order'`

**Possible Issues**:
- No work items with type 'customify_order' in database
- RLS policy blocking query
- Missing columns in database schema
- Frontend error not caught

**Impact**: MEDIUM - Prevents Customify order workflow

---

## 📋 Required Changes

### Phase 1: Fix Customers List View (PRIMARY WORKSPACE)

**File**: `app/(dashboard)/customers/page.tsx`

**Changes Needed**:

1. **Add Database Fields to Query** (lines 80-99):
```typescript
const { data, error } = await supabase
  .from('customers')
  .select(`
    *,
    work_items (
      id,
      status,
      created_at,
      updated_at
    ),
    assigned_to_user:users!assigned_to_user_id(id, full_name, email)  // NEW
  `)
```

2. **Add Missing Columns to Table** (lines 334-342):
```typescript
<TableHeader>
  <TableRow>
    <TableHead>Customer</TableHead>
    <TableHead>Assigned To</TableHead>        {/* NEW */}
    <TableHead>Company</TableHead>            {/* NEW */}
    <TableHead>Email</TableHead>               {/* SPLIT from Contact */}
    <TableHead>Phone</TableHead>               {/* SPLIT from Contact */}
    <TableHead>Projects</TableHead>
    <TableHead>Est. Value</TableHead>          {/* NEW */}
    <TableHead>Next Follow-Up</TableHead>      {/* NEW */}
    <TableHead>Actions</TableHead>
  </TableRow>
</TableHeader>
```

3. **Add Cell Rendering**:
```typescript
<TableCell>
  {customer.assigned_to_user?.full_name || (
    <span className="text-muted-foreground text-sm">Unassigned</span>
  )}
</TableCell>
<TableCell>{customer.organization_name || '-'}</TableCell>
<TableCell>{customer.email}</TableCell>
<TableCell>{customer.phone || '-'}</TableCell>
<TableCell className="text-center">
  <Badge>{customer.project_count || 0}</Badge>
</TableCell>
<TableCell>
  {customer.estimated_value ? (
    <span className="font-medium">${customer.estimated_value.toLocaleString()}</span>
  ) : (
    '-'
  )}
</TableCell>
<TableCell>
  {customer.next_follow_up_at ? (
    <span className="text-sm">
      {format(new Date(customer.next_follow_up_at), 'MMM d, yyyy')}
    </span>
  ) : (
    <span className="text-muted-foreground text-sm">Not set</span>
  )}
</TableCell>
```

4. **Database Schema Check**:
Need to verify these columns exist on `customers` table:
- `assigned_to_user_id` UUID (references users.id)
- `organization_name` TEXT
- `estimated_value` NUMERIC
- `next_follow_up_at` TIMESTAMPTZ

---

### Phase 2: Transform All Projects to Production View

**File**: `app/(dashboard)/work-items/page.tsx`

**Changes Needed**:

1. **Change Title & Purpose** (lines 193-200):
```typescript
<h1 className="text-3xl font-bold">All Projects</h1>
<p className="text-muted-foreground">
  Track design and production status for all active projects
</p>
```

2. **Replace Stats Cards** (lines 202-222):
```typescript
<Card>
  <CardContent className="pt-6">
    <div className="text-2xl font-bold">{inProductionCount}</div>
    <p className="text-xs text-muted-foreground">In Production</p>
  </CardContent>
</Card>
<Card>
  <CardContent className="pt-6">
    <div className="text-2xl font-bold">{upcomingEventsCount}</div>
    <p className="text-xs text-muted-foreground">Events This Week</p>
  </CardContent>
</Card>
<Card>
  <CardContent className="pt-6">
    <div className="text-2xl font-bold">{needingDesignCount}</div>
    <p className="text-xs text-muted-foreground">Awaiting Design</p>
  </CardContent>
</Card>
```

3. **Change Filter Buttons** (lines 228-248):
```typescript
// REMOVE: My Leads / All Leads
// REPLACE WITH:
<div className="flex gap-2">
  <Button
    variant={filterMode === 'my-projects' ? 'default' : 'outline'}
    size="sm"
    onClick={() => setFilterMode('my-projects')}
    className="gap-2 h-9"
  >
    <User className="h-4 w-4" />
    My Projects
  </Button>
  <Button
    variant={filterMode === 'all-projects' ? 'default' : 'outline'}
    size="sm"
    onClick={() => setFilterMode('all-projects')}
    className="gap-2 h-9"
  >
    <Users className="h-4 w-4" />
    All Projects
  </Button>
  <Button
    variant={filterMode === 'need-design' ? 'default' : 'outline'}
    size="sm"
    onClick={() => setFilterMode('need-design')}
    className="gap-2 h-9"
  >
    <Palette className="h-4 w-4" />
    Needs Design
  </Button>
</div>
```

4. **Replace Table Columns**:

**REMOVE** (Sales-focused):
- Company
- Email
- Phone
- Est. Value
- Next Follow-Up

**KEEP/ADD** (Production-focused):
- ✅ Checkbox (for bulk actions)
- ✅ Project Title/Name
- ✅ Customer Name (with link to customer page)
- ✅ Designer Assigned
- ✅ Production Status (with color-coded badge)
- ✅ Event Date (with urgency indicator)
- ✅ Files/Proofs Count
- ✅ Last Updated
- ✅ Actions (Quick view, Edit)

5. **Table Header**:
```typescript
<TableHeader>
  <TableRow>
    <th className="w-12 p-3"><Checkbox /></th>
    <th>Project</th>
    <th>Customer</th>
    <th>Designer</th>
    <th>Status</th>
    <th>Event Date</th>
    <th>Files</th>
    <th>Updated</th>
    <th>Actions</th>
  </TableRow>
</TableHeader>
```

---

### Phase 3: Fix/Debug Customify Orders Page

**File**: `app/(dashboard)/customify-orders/page.tsx`

**Investigation Steps**:
1. Check if any `work_items` exist with `type = 'customify_order'` in database
2. Verify RLS policies allow reading these records
3. Add error boundary and loading states
4. Check if `design_review_status` column exists and has correct values

**Quick Fix**:
Add better error handling and empty state:
```typescript
if (error) {
  return <ErrorState error={error} />
}

if (!orders || orders.length === 0) {
  return <EmptyState message="No Customify orders pending review" />
}
```

---

## 🗂️ Database Schema Requirements

### Customers Table
```sql
-- Check if these columns exist:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'customers'
AND column_name IN (
  'assigned_to_user_id',
  'organization_name',
  'estimated_value',
  'next_follow_up_at',
  'sales_stage'
);
```

**If missing, create migration**:
```sql
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS organization_name TEXT,
ADD COLUMN IF NOT EXISTS estimated_value NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sales_stage TEXT DEFAULT 'new_lead';

CREATE INDEX IF NOT EXISTS idx_customers_assigned_to
ON customers(assigned_to_user_id);

CREATE INDEX IF NOT EXISTS idx_customers_sales_stage
ON customers(sales_stage);

CREATE INDEX IF NOT EXISTS idx_customers_next_follow_up
ON customers(next_follow_up_at)
WHERE next_follow_up_at IS NOT NULL;
```

---

## 📊 Priority Order

### Priority 1: Customers List (IMMEDIATE)
- **Why**: This is the PRIMARY workspace per PDR v4
- **Impact**: Sales team can't effectively manage relationships
- **Effort**: Medium (add 4 columns, update query)

### Priority 2: All Projects Transformation (HIGH)
- **Why**: Currently confusing sales with production
- **Impact**: Designers can't find their work, operations team confused
- **Effort**: High (major refactor of page purpose)

### Priority 3: Customify Orders Debug (MEDIUM)
- **Why**: Blocking specific workflow
- **Impact**: Can't process Customify orders
- **Effort**: Low-Medium (debugging + empty state)

---

## ✅ Success Criteria

### Customers Page
- [ ] Shows all 8 required columns
- [ ] Can sort by any column
- [ ] Shows assigned team member
- [ ] Shows company name
- [ ] Shows estimated deal value
- [ ] Shows next follow-up date
- [ ] Links to customer detail page work

### All Projects Page
- [ ] Title says "All Projects" not "Sales Leads"
- [ ] Stats are production-focused
- [ ] Filters: My Projects / All Projects / Needs Design
- [ ] Shows: Project, Customer, Designer, Status, Event Date, Files
- [ ] Does NOT show: Email, Phone, Est. Value, Follow-Up
- [ ] Links to customer pages work
- [ ] Can assign designers
- [ ] Can filter by production status

### Customify Orders
- [ ] Page loads without errors
- [ ] Shows orders if any exist
- [ ] Shows helpful empty state if none exist
- [ ] Can review and approve designs

---

## 🚀 Implementation Plan

**Step 1**: Create database migration for customers table fields
**Step 2**: Update Customers list view with new columns
**Step 3**: Transform All Projects page from sales to production focus
**Step 4**: Debug and fix Customify Orders page
**Step 5**: Test all changes
**Step 6**: Update documentation

---

**Next Action**: Start with Priority 1 (Customers List) since it's the PRIMARY workspace per PDR v4.
