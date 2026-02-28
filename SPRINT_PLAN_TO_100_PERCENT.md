# Sprint Plan: 85% → 100% Complete
**Goal**: Ship production-ready, feature-complete CRM system
**Timeline**: 3 sprints (2 weeks)
**Start Date**: 2026-02-27

---

## 🎯 SPRINT OVERVIEW

| Sprint | Duration | Focus | Deliverables |
|--------|----------|-------|--------------|
| **Sprint 1** | 3 days | Shopify Integration + Designer Workflow | Orders display, Designer assignment, Event warnings |
| **Sprint 2** | 3-4 days | Operations & UX | Filtering, Sorting, Bulk actions, Status visual |
| **Sprint 3** | 2-3 days | Polish & Power Features | Email templates, Quick actions, Advanced search |

**Total Timeline**: 8-10 days (2 work weeks)

---

# 🚀 SPRINT 1: Core Operations (Days 1-3)
**Goal**: Complete critical business features
**Status**: MUST HAVE - System incomplete without these

## Day 1: Shopify Integration - Database & API (8 hours)

### Task 1.1: Database Schema (1 hour)
**File**: `migrations/create_shopify_orders_table.sql`

```sql
-- Create shopify_orders table
CREATE TABLE shopify_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_order_id TEXT UNIQUE NOT NULL,
  shopify_order_number TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  subtotal_price NUMERIC(10,2),
  total_tax NUMERIC(10,2),
  currency TEXT DEFAULT 'USD',
  financial_status TEXT, -- paid, pending, refunded, etc.
  fulfillment_status TEXT, -- fulfilled, partial, null
  line_items JSONB, -- Store line items
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  order_data JSONB -- Full Shopify order object for reference
);

-- Indexes for performance
CREATE INDEX idx_shopify_orders_customer_id ON shopify_orders(customer_id);
CREATE INDEX idx_shopify_orders_customer_email ON shopify_orders(customer_email);
CREATE INDEX idx_shopify_orders_created_at ON shopify_orders(created_at DESC);
CREATE INDEX idx_shopify_orders_shopify_id ON shopify_orders(shopify_order_id);

-- RLS Policies
ALTER TABLE shopify_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all shopify orders"
  ON shopify_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only service role can insert/update shopify orders"
  ON shopify_orders FOR ALL
  TO service_role
  USING (true);
```

**Acceptance Criteria**:
- [ ] Table created in Supabase
- [ ] Indexes created
- [ ] RLS policies active
- [ ] Can query via Supabase client

---

### Task 1.2: Shopify API Client Setup (1.5 hours)
**File**: `lib/shopify/client.ts`

```typescript
import '@shopify/shopify-api/adapters/node'
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api'

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: ['read_orders', 'read_customers'],
  hostName: process.env.SHOPIFY_SHOP_DOMAIN!.replace('https://', ''),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: false,
})

export const createShopifySession = () => {
  return shopify.session.customAppSession(process.env.SHOPIFY_SHOP_DOMAIN!)
}

export default shopify
```

**Environment Variables** (add to `.env.local`):
```
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=your_access_token
```

**Acceptance Criteria**:
- [ ] Shopify API package installed
- [ ] Environment variables configured
- [ ] Can authenticate with Shopify
- [ ] Test connection successful

---

### Task 1.3: Order Sync API Endpoint (2 hours)
**File**: `app/api/shopify/sync-orders/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import shopify, { createShopifySession } from '@/lib/shopify/client'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth check - only authenticated users can trigger sync
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = createShopifySession()
    const client = new shopify.clients.Rest({ session })

    // Fetch orders from Shopify (last 250, can paginate later)
    const response = await client.get({
      path: 'orders',
      query: {
        status: 'any',
        limit: '250',
        fields: 'id,name,email,total_price,subtotal_price,total_tax,currency,financial_status,fulfillment_status,line_items,created_at,updated_at'
      },
    })

    const orders = response.body.orders

    let syncedCount = 0
    let matchedCustomers = 0

    for (const order of orders) {
      // Try to match customer by email
      let customerId = null
      if (order.email) {
        const { data: customer } = await supabase
          .from('customers')
          .select('id')
          .eq('email', order.email.toLowerCase())
          .single()

        if (customer) {
          customerId = customer.id
          matchedCustomers++
        }
      }

      // Upsert order
      const { error } = await supabase
        .from('shopify_orders')
        .upsert({
          shopify_order_id: order.id.toString(),
          shopify_order_number: order.name,
          customer_id: customerId,
          customer_email: order.email?.toLowerCase() || '',
          total_price: parseFloat(order.total_price),
          subtotal_price: parseFloat(order.subtotal_price || 0),
          total_tax: parseFloat(order.total_tax || 0),
          currency: order.currency,
          financial_status: order.financial_status,
          fulfillment_status: order.fulfillment_status,
          line_items: order.line_items,
          created_at: order.created_at,
          updated_at: order.updated_at,
          order_data: order
        }, {
          onConflict: 'shopify_order_id'
        })

      if (!error) syncedCount++
    }

    return NextResponse.json({
      success: true,
      synced: syncedCount,
      total: orders.length,
      matchedCustomers
    })

  } catch (error: any) {
    console.error('Shopify sync error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to sync orders' },
      { status: 500 }
    )
  }
}
```

**Acceptance Criteria**:
- [ ] API endpoint created
- [ ] Can fetch orders from Shopify
- [ ] Matches customers by email
- [ ] Upserts orders to database
- [ ] Returns sync statistics
- [ ] Error handling works

---

### Task 1.4: Shopify Orders Tab UI Component (3.5 hours)
**File**: `components/shopify/shopify-orders-tab.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RefreshCw, ExternalLink, DollarSign, Package, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface ShopifyOrdersTabProps {
  customerId: string
  customerEmail: string
}

export function ShopifyOrdersTab({ customerId, customerEmail }: ShopifyOrdersTabProps) {
  const queryClient = useQueryClient()
  const [isSyncing, setIsSyncing] = useState(false)

  // Fetch orders for this customer
  const { data: orders, isLoading } = useQuery({
    queryKey: ['shopify-orders', customerId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('shopify_orders')
        .select('*')
        .or(`customer_id.eq.${customerId},customer_email.eq.${customerEmail}`)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
  })

  // Sync orders mutation
  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch('/api/shopify/sync-orders', {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        toast.success(`Synced ${data.synced} orders from Shopify`)
        queryClient.invalidateQueries({ queryKey: ['shopify-orders'] })
      } else {
        toast.error(data.error || 'Failed to sync orders')
      }
    } catch (error) {
      toast.error('Failed to sync orders')
    } finally {
      setIsSyncing(false)
    }
  }

  const getFinancialStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      paid: 'default',
      pending: 'secondary',
      refunded: 'destructive',
      partially_refunded: 'outline',
    }
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>
  }

  const getFulfillmentStatusIcon = (status: string | null) => {
    if (status === 'fulfilled') return <CheckCircle2 className="h-4 w-4 text-green-600" />
    if (status === 'partial') return <Clock className="h-4 w-4 text-yellow-600" />
    return <Package className="h-4 w-4 text-gray-400" />
  }

  if (isLoading) {
    return <div className="p-6 text-center">Loading orders...</div>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Shopify Order History</CardTitle>
            <Button
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Orders'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!orders || orders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-semibold mb-2">No Orders Found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                No Shopify orders found for this customer.
              </p>
              <Button size="sm" onClick={handleSync} disabled={isSyncing}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Now
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Fulfillment</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order: any) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.shopify_order_number}
                      </TableCell>
                      <TableCell>
                        {format(new Date(order.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {order.line_items?.length || 0} items
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">
                            {parseFloat(order.total_price).toFixed(2)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {order.currency}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getFinancialStatusBadge(order.financial_status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getFulfillmentStatusIcon(order.fulfillment_status)}
                          <span className="text-sm text-muted-foreground">
                            {order.fulfillment_status || 'Unfulfilled'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <a
                          href={`https://${process.env.NEXT_PUBLIC_SHOPIFY_SHOP_DOMAIN}/admin/orders/${order.shopify_order_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Statistics */}
      {orders && orders.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {orders.length}
              </div>
              <p className="text-xs text-muted-foreground">Total Orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                ${orders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price), 0).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                ${(orders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price), 0) / orders.length).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Average Order</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
```

**Wire up in Customer Detail Page**:
Replace placeholder in `app/(dashboard)/customers/[id]/page.tsx`:

```typescript
import { ShopifyOrdersTab } from '@/components/shopify/shopify-orders-tab'

// In the Shopify tab content:
<TabsContent value="shopify">
  <ShopifyOrdersTab
    customerId={customerId}
    customerEmail={customer.email}
  />
</TabsContent>
```

**Acceptance Criteria**:
- [ ] Component displays orders table
- [ ] Shows order number, date, items, amount, status
- [ ] Sync button works
- [ ] Links to Shopify admin
- [ ] Shows statistics cards
- [ ] Empty state when no orders
- [ ] Mobile responsive

---

## Day 2: Designer Assignment & Event Warnings (8 hours)

### Task 2.1: Designer Assignment - Database Migration (0.5 hours)

**Check if `assigned_to_user_id` exists on `work_items` table**:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'work_items'
AND column_name = 'assigned_to_user_id';
```

**If missing, create**:
```sql
ALTER TABLE work_items
ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_work_items_assigned_to
ON work_items(assigned_to_user_id)
WHERE assigned_to_user_id IS NOT NULL;
```

**Acceptance Criteria**:
- [ ] Column exists
- [ ] Foreign key to users table
- [ ] Index created

---

### Task 2.2: Designer Assignment Dropdown Component (2 hours)
**File**: `components/projects/assign-designer-dialog.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { UserPlus, Loader2 } from 'lucide-react'

interface AssignDesignerDialogProps {
  projectId: string
  currentDesignerId?: string | null
  trigger?: React.ReactNode
}

export function AssignDesignerDialog({
  projectId,
  currentDesignerId,
  trigger
}: AssignDesignerDialogProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [selectedDesignerId, setSelectedDesignerId] = useState(currentDesignerId || '')

  // Fetch all users who can be designers
  const { data: users } = useQuery({
    queryKey: ['users-for-assignment'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .order('full_name')

      if (error) throw error
      return data
    },
  })

  const assignMutation = useMutation({
    mutationFn: async (designerId: string | null) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('work_items')
        .update({ assigned_to_user_id: designerId || null })
        .eq('id', projectId)

      if (error) throw error

      // Create activity log
      const { data: { user } } = await supabase.auth.getUser()
      const designer = users?.find(u => u.id === designerId)

      await supabase.from('activity_logs').insert({
        activity_type: designerId ? 'designer_assigned' : 'designer_unassigned',
        related_entity_type: 'work_item',
        related_entity_id: projectId,
        user_id: user?.id,
        metadata: {
          designer_id: designerId,
          designer_name: designer?.full_name || designer?.email
        }
      })
    },
    onSuccess: () => {
      toast.success('Designer assigned successfully')
      queryClient.invalidateQueries({ queryKey: ['work-items'] })
      queryClient.invalidateQueries({ queryKey: ['project-detail'] })
      setOpen(false)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to assign designer')
    },
  })

  const handleAssign = () => {
    assignMutation.mutate(selectedDesignerId || null)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <UserPlus className="mr-2 h-4 w-4" />
            Assign Designer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assign Designer</DialogTitle>
          <DialogDescription>
            Select a team member to assign to this project
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="designer">Designer</Label>
            <Select
              value={selectedDesignerId}
              onValueChange={setSelectedDesignerId}
            >
              <SelectTrigger id="designer">
                <SelectValue placeholder="Select designer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={assignMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={assignMutation.isPending}
          >
            {assignMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Acceptance Criteria**:
- [ ] Component renders dialog
- [ ] Shows all users in dropdown
- [ ] Can assign/unassign designer
- [ ] Updates database
- [ ] Creates activity log entry
- [ ] Shows success toast
- [ ] Invalidates queries

---

### Task 2.3: Wire Up Designer Assignment (1.5 hours)

**Add to Project Detail Page** (`components/customers/project-detail-view.tsx`):
```typescript
import { AssignDesignerDialog } from '@/components/projects/assign-designer-dialog'

// In header section, add after Update Status:
<AssignDesignerDialog
  projectId={projectId}
  currentDesignerId={project.assigned_to_user_id}
/>
```

**Add to All Projects Table** (`app/(dashboard)/work-items/page.tsx`):

In the actions dropdown menu:
```typescript
<DropdownMenuItem
  onClick={(e) => {
    e.preventDefault()
    e.stopPropagation()
    // Open assign dialog
  }}
>
  <UserPlus className="mr-2 h-4 w-4" />
  Assign Designer
</DropdownMenuItem>
```

Or add inline button in the Designer column:
```typescript
<TableCell>
  {extendedItem.assigned_to ? (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
            {getInitials(extendedItem.assigned_to.full_name)}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm">{extendedItem.assigned_to.full_name}</span>
      </div>
      <AssignDesignerDialog
        projectId={item.id}
        currentDesignerId={extendedItem.assigned_to.id}
        trigger={
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <UserPlus className="h-3 w-3" />
          </Button>
        }
      />
    </div>
  ) : (
    <AssignDesignerDialog
      projectId={item.id}
      trigger={
        <Button variant="outline" size="sm">
          <UserPlus className="mr-2 h-4 w-4" />
          Assign
        </Button>
      }
    />
  )}
</TableCell>
```

**Acceptance Criteria**:
- [ ] Assign button on project detail page
- [ ] Assign action in All Projects table
- [ ] Both trigger the dialog
- [ ] Can assign from both locations

---

### Task 2.4: "My Projects" Filter Implementation (1 hour)

**Update `app/(dashboard)/work-items/page.tsx`**:

The filter already exists in the UI, just need to ensure it's working:

```typescript
const { data: workItems, isLoading } = useWorkItems({
  search: debouncedSearch,
  assignedTo: filterMode === 'my-projects' ? 'me' : undefined, // Already implemented!
  status: filterMode === 'need-design' ? 'new_inquiry,awaiting_approval' : undefined
})
```

Test that it works correctly.

**Acceptance Criteria**:
- [ ] "My Projects" button filters to current user
- [ ] Shows only assigned projects
- [ ] Updates count in stats
- [ ] Persists filter when switching views

---

### Task 2.5: Event Date Countdown Component (2 hours)
**File**: `components/projects/event-countdown.tsx`

```typescript
'use client'

import { differenceInDays, format, isPast, isFuture } from 'date-fns'
import { Calendar, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface EventCountdownProps {
  eventDate: string
  className?: string
  showIcon?: boolean
}

export function EventCountdown({ eventDate, className, showIcon = true }: EventCountdownProps) {
  const date = new Date(eventDate)
  const daysUntil = differenceInDays(date, new Date())
  const hasPassed = isPast(date)

  // Urgency levels
  const isUrgent = daysUntil <= 7 && daysUntil >= 0 // Less than 7 days
  const isWarning = daysUntil <= 14 && daysUntil > 7 // 7-14 days
  const isOverdue = hasPassed

  const getVariant = () => {
    if (isOverdue) return 'destructive'
    if (isUrgent) return 'destructive'
    if (isWarning) return 'secondary'
    return 'outline'
  }

  const getLabel = () => {
    if (isOverdue) return `${Math.abs(daysUntil)} days ago`
    if (daysUntil === 0) return 'Today!'
    if (daysUntil === 1) return 'Tomorrow'
    return `${daysUntil} days`
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showIcon && (
        <>
          {isUrgent || isOverdue ? (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          ) : (
            <Calendar className="h-4 w-4 text-muted-foreground" />
          )}
        </>
      )}
      <div className="flex flex-col">
        <div className="text-sm font-medium">
          {format(date, 'MMM d, yyyy')}
        </div>
        <Badge variant={getVariant()} className="text-xs w-fit">
          {getLabel()}
        </Badge>
      </div>
    </div>
  )
}

// Compact version for tables
export function EventCountdownCompact({ eventDate }: { eventDate: string }) {
  const date = new Date(eventDate)
  const daysUntil = differenceInDays(date, new Date())
  const isUrgent = daysUntil <= 7 && daysUntil >= 0
  const isOverdue = isPast(date)

  return (
    <div className="flex flex-col">
      <div className="text-sm">{format(date, 'MMM d, yyyy')}</div>
      <div className={cn(
        'text-xs',
        isOverdue && 'text-red-600 font-medium',
        isUrgent && 'text-orange-600 font-medium',
        !isOverdue && !isUrgent && 'text-muted-foreground'
      )}>
        {isOverdue ? `${Math.abs(daysUntil)} days ago` :
         daysUntil === 0 ? 'Today!' :
         daysUntil === 1 ? 'Tomorrow' :
         `${daysUntil} days`}
      </div>
    </div>
  )
}
```

**Wire up in Project Detail Header**:
```typescript
import { EventCountdown } from '@/components/projects/event-countdown'

{project.event_date && (
  <EventCountdown eventDate={project.event_date} />
)}
```

**Wire up in All Projects Table**:
```typescript
import { EventCountdownCompact } from '@/components/projects/event-countdown'

<TableCell>
  {item.event_date ? (
    <EventCountdownCompact eventDate={item.event_date} />
  ) : (
    <span className="text-sm text-muted-foreground/50">-</span>
  )}
</TableCell>
```

**Acceptance Criteria**:
- [ ] Shows countdown to event
- [ ] Color codes by urgency (red < 7 days, yellow < 14 days)
- [ ] Shows "Today" and "Tomorrow" labels
- [ ] Shows past events as "X days ago"
- [ ] Works in project detail and All Projects table

---

### Task 2.6: "Needs Design" Filter (1 hour)

**Add to `app/(dashboard)/work-items/page.tsx`**:

The filter mode already exists, just need the UI button:

```typescript
<Button
  variant={filterMode === 'need-design' ? 'default' : 'outline'}
  size="sm"
  onClick={() => setFilterMode('need-design')}
  className="gap-2 h-9"
>
  <Palette className="h-4 w-4" />
  Needs Design
</Button>
```

Import Palette icon:
```typescript
import { Palette } from 'lucide-react'
```

**Acceptance Criteria**:
- [ ] Button visible in filter section
- [ ] Filters to new_inquiry + awaiting_approval
- [ ] Updates count in stats
- [ ] Deselects other filters

---

## Day 3: Testing & Polish Sprint 1 (8 hours)

### Task 3.1: End-to-End Testing (3 hours)

**Test Shopify Integration**:
- [ ] Run database migration
- [ ] Configure Shopify API credentials
- [ ] Test sync endpoint manually
- [ ] Verify orders appear in database
- [ ] Check customer matching by email
- [ ] Test UI: Sync button, table, stats
- [ ] Test Shopify admin links
- [ ] Test empty state

**Test Designer Assignment**:
- [ ] Verify database column exists
- [ ] Test assign dialog opens
- [ ] Test assigning designer
- [ ] Test unassigning designer
- [ ] Verify activity log created
- [ ] Test "My Projects" filter
- [ ] Test from project detail page
- [ ] Test from All Projects table

**Test Event Countdown**:
- [ ] Test with future dates (various days away)
- [ ] Test with today's date
- [ ] Test with past dates
- [ ] Verify color coding (red, yellow, gray)
- [ ] Test in project detail
- [ ] Test in All Projects table
- [ ] Test mobile responsive

---

### Task 3.2: Bug Fixes & Edge Cases (2 hours)

- [ ] Handle missing Shopify credentials gracefully
- [ ] Handle customers with no email
- [ ] Handle projects with no event date
- [ ] Handle timezone issues with event dates
- [ ] Test with no users in system
- [ ] Test with no designers assigned
- [ ] Error handling for failed API calls

---

### Task 3.3: Documentation (2 hours)

**Create**: `docs/SHOPIFY_SETUP.md`
```markdown
# Shopify Integration Setup

## Prerequisites
- Shopify store with API access
- Custom app or public app credentials

## Setup Steps

1. Create Shopify Custom App
2. Get API credentials
3. Add environment variables
4. Run database migration
5. Initial sync
6. Set up webhooks (optional)

[Detailed instructions...]
```

**Create**: `docs/DESIGNER_WORKFLOW.md`
```markdown
# Designer Workflow Guide

## Assigning Projects
- From project detail page
- From All Projects table
- Bulk assignment (future)

## My Projects View
- Filter to see only your projects
- Sort by event date
- Prioritize urgent work

[Detailed instructions...]
```

**Update**: `SPRINT_PROGRESS.md` with completed tasks

---

### Task 3.4: Code Review & Cleanup (1 hour)

- [ ] Remove console.logs
- [ ] Add TypeScript types
- [ ] Add error boundaries
- [ ] Consistent naming conventions
- [ ] Remove dead code
- [ ] Format with Prettier

---

## Sprint 1 Deliverables ✅

**What Ships**:
1. ✅ Shopify orders display on customer page
2. ✅ Manual sync button (can sync any time)
3. ✅ Designer assignment from project detail & All Projects
4. ✅ "My Projects" filter works correctly
5. ✅ Event countdown with urgency indicators
6. ✅ "Needs Design" filter

**Business Value**:
- See all customer purchase history
- Track revenue per customer
- Assign work to designers
- See personal workload
- Prioritize urgent projects by event date

**System Completeness**: 85% → 92%

---

# 🎨 SPRINT 2: Operations & UX (Days 4-7)
**Goal**: Professional polish and operational efficiency
**Status**: SHOULD HAVE - Major quality improvements

## Day 4: Production Status Visual + Table Sorting (8 hours)

### Task 4.1: Production Status Progress Component (3 hours)
**File**: `components/projects/production-status-visual.tsx`

```typescript
'use client'

import { Check, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProductionStatusVisualProps {
  currentStatus: string
  className?: string
}

// Status flow configuration
const STATUS_FLOW = [
  { key: 'new_inquiry', label: 'Inquiry', color: 'bg-blue-500' },
  { key: 'awaiting_approval', label: 'Quote Sent', color: 'bg-purple-500' },
  { key: 'in_design', label: 'In Design', color: 'bg-yellow-500' },
  { key: 'approved', label: 'Approved', color: 'bg-green-500' },
  { key: 'in_production', label: 'Production', color: 'bg-orange-500' },
  { key: 'shipped', label: 'Shipped', color: 'bg-gray-500' },
]

export function ProductionStatusVisual({ currentStatus, className }: ProductionStatusVisualProps) {
  const currentIndex = STATUS_FLOW.findIndex(s => s.key === currentStatus)

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between relative">
        {/* Progress Line */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 -z-10" />
        <div
          className="absolute top-4 left-0 h-0.5 bg-primary -z-10 transition-all duration-500"
          style={{
            width: `${(currentIndex / (STATUS_FLOW.length - 1)) * 100}%`
          }}
        />

        {/* Status Nodes */}
        {STATUS_FLOW.map((status, index) => {
          const isComplete = index < currentIndex
          const isCurrent = index === currentIndex
          const isFuture = index > currentIndex

          return (
            <div key={status.key} className="flex flex-col items-center gap-2 flex-1">
              {/* Node */}
              <div
                className={cn(
                  'w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all',
                  isComplete && 'bg-primary border-primary',
                  isCurrent && 'bg-white border-primary scale-110',
                  isFuture && 'bg-white border-gray-300'
                )}
              >
                {isComplete ? (
                  <Check className="h-4 w-4 text-white" />
                ) : isCurrent ? (
                  <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                ) : (
                  <Circle className="h-4 w-4 text-gray-300" />
                )}
              </div>

              {/* Label */}
              <div
                className={cn(
                  'text-xs text-center transition-all',
                  (isComplete || isCurrent) && 'font-medium text-foreground',
                  isFuture && 'text-muted-foreground'
                )}
              >
                {status.label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Add to Project Detail Page** (`components/customers/project-detail-view.tsx`):

```typescript
import { ProductionStatusVisual } from '@/components/projects/production-status-visual'

// Add in Details tab or header:
<Card>
  <CardHeader>
    <CardTitle className="text-base">Production Progress</CardTitle>
  </CardHeader>
  <CardContent>
    <ProductionStatusVisual currentStatus={project.status} />
  </CardContent>
</Card>
```

**Acceptance Criteria**:
- [ ] Shows 6-stage progress flow
- [ ] Highlights current status
- [ ] Shows completed stages with checkmarks
- [ ] Progress line fills based on status
- [ ] Animates current status
- [ ] Mobile responsive
- [ ] Works in project detail page

---

### Task 4.2: Sortable Table Columns (3 hours)

**Install Package**:
```bash
npm install @tanstack/react-table
```

**Update All Projects Table** (`app/(dashboard)/work-items/page.tsx`):

Replace current table with react-table implementation:

```typescript
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'

// Define columns
const columnHelper = createColumnHelper<WorkItem>()

const columns = [
  columnHelper.display({
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllRowsSelected()}
        onCheckedChange={(checked) => table.toggleAllRowsSelected(!!checked)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(checked) => row.toggleSelected(!!checked)}
      />
    ),
  }),
  columnHelper.accessor('title', {
    header: 'Project',
    cell: (info) => info.getValue() || 'Untitled',
  }),
  columnHelper.accessor('customer_name', {
    header: 'Customer',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('assigned_to.full_name', {
    header: 'Designer',
    cell: (info) => info.getValue() || 'Unassigned',
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  columnHelper.accessor('event_date', {
    header: 'Event Date',
    cell: (info) => {
      const date = info.getValue()
      return date ? <EventCountdownCompact eventDate={date} /> : '-'
    },
    sortingFn: 'datetime',
  }),
  columnHelper.accessor('file_count', {
    header: 'Files',
    cell: (info) => info.getValue() || 0,
  }),
  columnHelper.accessor('updated_at', {
    header: 'Updated',
    cell: (info) => formatDistanceToNow(new Date(info.getValue()), { addSuffix: true }),
    sortingFn: 'datetime',
  }),
  // ... actions column
]

const table = useReactTable({
  data: sortedWorkItems,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
})

// Render
<Table>
  <TableHeader>
    {table.getHeaderGroups().map((headerGroup) => (
      <TableRow key={headerGroup.id}>
        {headerGroup.headers.map((header) => (
          <TableHead
            key={header.id}
            onClick={header.column.getToggleSortingHandler()}
            className="cursor-pointer hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              {flexRender(header.column.columnDef.header, header.getContext())}
              {header.column.getIsSorted() && (
                <span>
                  {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </div>
          </TableHead>
        ))}
      </TableRow>
    ))}
  </TableHeader>
  <TableBody>
    {table.getRowModel().rows.map((row) => (
      <TableRow key={row.id}>
        {row.getVisibleCells().map((cell) => (
          <TableCell key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    ))}
  </TableBody>
</Table>
```

**Also add to Customers List Table**:
Same pattern for sortable customers table.

**Acceptance Criteria**:
- [ ] All columns clickable to sort
- [ ] Shows sort direction indicator (↑↓)
- [ ] Sorts ascending/descending
- [ ] Date columns sort correctly
- [ ] Number columns sort correctly
- [ ] Works on All Projects page
- [ ] Works on Customers page

---

### Task 4.3: Keyboard Shortcuts (1 hour)

**File**: `hooks/use-keyboard-shortcuts.ts`

```typescript
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function useKeyboardShortcuts() {
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K: Global search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        // Open search modal
      }

      // G then C: Go to Customers
      if (e.key === 'g') {
        const nextKey = (e: KeyboardEvent) => {
          if (e.key === 'c') router.push('/customers')
          if (e.key === 'p') router.push('/work-items')
          window.removeEventListener('keydown', nextKey)
        }
        window.addEventListener('keydown', nextKey)
        setTimeout(() => window.removeEventListener('keydown', nextKey), 1000)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router])
}
```

Add to root layout to enable globally.

**Acceptance Criteria**:
- [ ] Cmd+K opens search
- [ ] G then C navigates to Customers
- [ ] G then P navigates to Projects
- [ ] Works across all pages

---

### Task 4.4: Performance Optimization (1 hour)

- [ ] Add React.memo to heavy components
- [ ] Implement virtualization for long lists
- [ ] Optimize Supabase queries (select only needed fields)
- [ ] Add query caching strategy
- [ ] Lazy load heavy components

---

## Day 5: Advanced Filtering (8 hours)

### Task 5.1: Multi-Filter UI Component (3 hours)
**File**: `components/filters/advanced-filter-panel.tsx`

```typescript
'use client'

import { useState } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Filter, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface FilterConfig {
  statuses: string[]
  designers: string[]
  dateRange: { from: Date | null; to: Date | null }
  hasEventDate: boolean | null
}

interface AdvancedFilterPanelProps {
  onFilterChange: (filters: FilterConfig) => void
  activeFilterCount: number
}

export function AdvancedFilterPanel({
  onFilterChange,
  activeFilterCount
}: AdvancedFilterPanelProps) {
  const [filters, setFilters] = useState<FilterConfig>({
    statuses: [],
    designers: [],
    dateRange: { from: null, to: null },
    hasEventDate: null,
  })

  const handleStatusToggle = (status: string) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status]

    const newFilters = { ...filters, statuses: newStatuses }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const clearFilters = () => {
    const emptyFilters: FilterConfig = {
      statuses: [],
      designers: [],
      dateRange: { from: null, to: null },
      hasEventDate: null,
    }
    setFilters(emptyFilters)
    onFilterChange(emptyFilters)
  }

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Filters</h4>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8"
                >
                  Clear all
                </Button>
              )}
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="space-y-2">
                {['new_inquiry', 'awaiting_approval', 'in_design', 'approved', 'in_production', 'shipped'].map((status) => (
                  <div key={status} className="flex items-center gap-2">
                    <Checkbox
                      id={`status-${status}`}
                      checked={filters.statuses.includes(status)}
                      onCheckedChange={() => handleStatusToggle(status)}
                    />
                    <label
                      htmlFor={`status-${status}`}
                      className="text-sm cursor-pointer"
                    >
                      {status.replace(/_/g, ' ')}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Designer Filter */}
            <div className="space-y-2">
              <Label>Designer</Label>
              <Select
                value={filters.designers[0] || ''}
                onValueChange={(value) => {
                  const newFilters = {
                    ...filters,
                    designers: value ? [value] : []
                  }
                  setFilters(newFilters)
                  onFilterChange(newFilters)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All designers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All designers</SelectItem>
                  {/* Populate from users query */}
                </SelectContent>
              </Select>
            </div>

            {/* Event Date Filter */}
            <div className="space-y-2">
              <Label>Event Date</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="has-event"
                    checked={filters.hasEventDate === true}
                    onCheckedChange={(checked) => {
                      const newFilters = {
                        ...filters,
                        hasEventDate: checked ? true : null
                      }
                      setFilters(newFilters)
                      onFilterChange(newFilters)
                    }}
                  />
                  <label htmlFor="has-event" className="text-sm cursor-pointer">
                    Has event date
                  </label>
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active Filter Pills */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {filters.statuses.map((status) => (
            <Badge key={status} variant="secondary" className="gap-1">
              {status.replace(/_/g, ' ')}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleStatusToggle(status)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Acceptance Criteria**:
- [ ] Opens filter panel
- [ ] Shows all filter options
- [ ] Can select multiple statuses
- [ ] Can filter by designer
- [ ] Can filter by event date
- [ ] Shows active filter count
- [ ] Shows active filters as pills
- [ ] Can remove individual filters
- [ ] Can clear all filters

---

### Task 5.2: Apply Filters to Query (2 hours)

**Update `lib/hooks/use-work-items.ts`**:

Add filter parameters to hook and apply to query:

```typescript
interface WorkItemFilters {
  statuses?: string[]
  designers?: string[]
  hasEventDate?: boolean | null
  // ... existing filters
}

export function useWorkItems(filters?: WorkItemFilters) {
  // ... existing code

  // Apply status filter
  if (filters?.statuses && filters.statuses.length > 0) {
    query = query.in('status', filters.statuses)
  }

  // Apply designer filter
  if (filters?.designers && filters.designers.length > 0) {
    query = query.in('assigned_to_user_id', filters.designers)
  }

  // Apply event date filter
  if (filters?.hasEventDate === true) {
    query = query.not('event_date', 'is', null)
  } else if (filters?.hasEventDate === false) {
    query = query.is('event_date', null)
  }

  // ... rest of query
}
```

**Wire up in All Projects page**:

```typescript
const [filters, setFilters] = useState<FilterConfig>({
  statuses: [],
  designers: [],
  dateRange: { from: null, to: null },
  hasEventDate: null,
})

const { data: workItems } = useWorkItems({
  search: debouncedSearch,
  statuses: filters.statuses,
  designers: filters.designers,
  hasEventDate: filters.hasEventDate,
})

<AdvancedFilterPanel
  onFilterChange={setFilters}
  activeFilterCount={
    filters.statuses.length +
    filters.designers.length +
    (filters.hasEventDate !== null ? 1 : 0)
  }
/>
```

**Acceptance Criteria**:
- [ ] Filters applied to database query
- [ ] Results update in real-time
- [ ] Multiple filters work together (AND logic)
- [ ] Performance is good with filters
- [ ] URL params update (optional)

---

### Task 5.3: Saved Filter Presets (2 hours)

Add common filter presets:

```typescript
const FILTER_PRESETS = [
  {
    name: 'Urgent Events',
    filters: { hasEventDate: true, statuses: ['new_inquiry', 'awaiting_approval', 'in_design'] }
  },
  {
    name: 'In Production',
    filters: { statuses: ['in_production'] }
  },
  {
    name: 'Awaiting Approval',
    filters: { statuses: ['awaiting_approval'] }
  },
]

<div className="flex gap-2">
  {FILTER_PRESETS.map((preset) => (
    <Button
      key={preset.name}
      variant="outline"
      size="sm"
      onClick={() => setFilters(preset.filters)}
    >
      {preset.name}
    </Button>
  ))}
</div>
```

**Acceptance Criteria**:
- [ ] Preset buttons visible
- [ ] Clicking applies filters
- [ ] Can combine with manual filters
- [ ] Visual indicator when preset active

---

### Task 5.4: Testing Filters (1 hour)

- [ ] Test each filter independently
- [ ] Test multiple filters together
- [ ] Test clearing filters
- [ ] Test with empty results
- [ ] Test with large datasets
- [ ] Test performance

---

## Day 6: Bulk Actions (8 hours)

### Task 6.1: Bulk Selection UI (2 hours)

**Already partially implemented in table**. Enhance it:

```typescript
// State for selected items
const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

// Select all handler
const handleSelectAll = (checked: boolean) => {
  if (checked) {
    setSelectedRows(new Set(workItems.map(item => item.id)))
  } else {
    setSelectedRows(new Set())
  }
}

// Individual select handler
const handleSelectRow = (itemId: string, checked: boolean) => {
  const newSelected = new Set(selectedRows)
  if (checked) {
    newSelected.add(itemId)
  } else {
    newSelected.delete(itemId)
  }
  setSelectedRows(newSelected)
}
```

**Acceptance Criteria**:
- [ ] Checkbox in header selects all
- [ ] Individual checkboxes work
- [ ] Selection persists during filtering
- [ ] Shows count of selected items

---

### Task 6.2: Bulk Action Toolbar (2 hours)

```typescript
{selectedRows.size > 0 && (
  <div className="border-b bg-muted/30 p-3 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">
        {selectedRows.size} item{selectedRows.size > 1 ? 's' : ''} selected
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setSelectedRows(new Set())}
      >
        Clear
      </Button>
    </div>
    <div className="flex items-center gap-2">
      <BulkAssignDesignerDialog
        projectIds={Array.from(selectedRows)}
        onComplete={() => setSelectedRows(new Set())}
      />
      <BulkStatusUpdateDialog
        projectIds={Array.from(selectedRows)}
        onComplete={() => setSelectedRows(new Set())}
      />
      <Button variant="outline" size="sm">
        Export Selected
      </Button>
    </div>
  </div>
)}
```

**Acceptance Criteria**:
- [ ] Toolbar appears when items selected
- [ ] Shows count
- [ ] Clear button works
- [ ] Action buttons enabled

---

### Task 6.3: Bulk Designer Assignment (2 hours)

**File**: `components/projects/bulk-assign-designer-dialog.tsx`

Similar to single assignment but handles multiple IDs:

```typescript
const assignMutation = useMutation({
  mutationFn: async (designerId: string | null) => {
    const supabase = createClient()

    // Update all selected projects
    const { error } = await supabase
      .from('work_items')
      .update({ assigned_to_user_id: designerId })
      .in('id', projectIds)

    if (error) throw error

    // Create activity logs for each
    const { data: { user } } = await supabase.auth.getUser()
    const designer = users?.find(u => u.id === designerId)

    const logs = projectIds.map(id => ({
      activity_type: designerId ? 'designer_assigned' : 'designer_unassigned',
      related_entity_type: 'work_item',
      related_entity_id: id,
      user_id: user?.id,
      metadata: {
        designer_id: designerId,
        designer_name: designer?.full_name,
        bulk_action: true,
        bulk_count: projectIds.length
      }
    }))

    await supabase.from('activity_logs').insert(logs)
  },
  onSuccess: () => {
    toast.success(`Assigned ${projectIds.length} projects`)
    queryClient.invalidateQueries({ queryKey: ['work-items'] })
    onComplete()
  },
})
```

**Acceptance Criteria**:
- [ ] Dialog opens with count
- [ ] Can assign designer to all selected
- [ ] Updates all projects at once
- [ ] Creates activity logs
- [ ] Shows success message
- [ ] Clears selection after

---

### Task 6.4: Bulk Status Update (2 hours)

**File**: `components/projects/bulk-status-update-dialog.tsx`

Similar pattern - update multiple projects to same status.

**Acceptance Criteria**:
- [ ] Dialog shows count
- [ ] Can select new status
- [ ] Updates all selected projects
- [ ] Creates activity logs
- [ ] Shows success message

---

## Day 7: Sprint 2 Testing & Documentation (8 hours)

### Task 7.1: End-to-End Testing (4 hours)

**Test Production Status Visual**:
- [ ] Shows correct progress for each status
- [ ] Animates properly
- [ ] Mobile responsive
- [ ] Works in project detail

**Test Sortable Tables**:
- [ ] All columns sortable
- [ ] Sort direction correct
- [ ] Performance with large datasets
- [ ] Works on Customers and Projects

**Test Advanced Filtering**:
- [ ] Each filter works independently
- [ ] Multiple filters work together
- [ ] Presets apply correctly
- [ ] Clear filters works
- [ ] Performance is good

**Test Bulk Actions**:
- [ ] Selection works
- [ ] Toolbar appears
- [ ] Bulk assign works
- [ ] Bulk status update works
- [ ] Activity logs created
- [ ] Selection clears after

---

### Task 7.2: Performance Testing (2 hours)

- [ ] Test with 100+ customers
- [ ] Test with 500+ projects
- [ ] Test filter performance
- [ ] Test sort performance
- [ ] Optimize slow queries
- [ ] Add loading states where needed

---

### Task 7.3: Documentation (2 hours)

**Update**:
- `docs/FILTERING_GUIDE.md`
- `docs/BULK_ACTIONS_GUIDE.md`
- `SPRINT_PROGRESS.md`

**Create**:
- Video walkthrough of new features
- Screenshots for documentation

---

## Sprint 2 Deliverables ✅

**What Ships**:
1. ✅ Production status visual progress indicator
2. ✅ Sortable columns on all tables
3. ✅ Advanced multi-filter system
4. ✅ Filter presets (Urgent, In Production, etc.)
5. ✅ Bulk selection UI
6. ✅ Bulk designer assignment
7. ✅ Bulk status update
8. ✅ Keyboard shortcuts

**Business Value**:
- Professional visual appearance
- Faster navigation and searching
- Efficient bulk operations
- Power user features
- Scalable for growing data

**System Completeness**: 92% → 97%

---

# 💎 SPRINT 3: Polish & Power Features (Days 8-10)
**Goal**: Professional polish and advanced features
**Status**: NICE TO HAVE - Quality of life improvements

## Day 8: Email Templates & ChatGPT Integration (8 hours)

### Task 8.1: Email Templates Database (1 hour)

```sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT, -- quote, follow_up, approval, etc.
  variables JSONB, -- {{customer_name}}, {{project_title}}, etc.
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_templates_category ON email_templates(category);
```

**Seed with common templates**:
```sql
INSERT INTO email_templates (name, subject, body, category) VALUES
('Initial Quote', 'Quote for {{project_title}}', 'Hi {{customer_name}},...', 'quote'),
('Follow Up', 'Following up on {{project_title}}', 'Hi {{customer_name}},...', 'follow_up'),
('Proof Ready', 'Your proof is ready for {{project_title}}', 'Hi {{customer_name}},...', 'proof'),
('Approval Needed', 'We need your approval for {{project_title}}', 'Hi {{customer_name}},...', 'approval');
```

---

### Task 8.2: Template Library UI (2 hours)

**File**: `components/email/email-template-library.tsx`

Add to email composer as dropdown or sidebar panel.

**Acceptance Criteria**:
- [ ] Shows all templates
- [ ] Categorized by type
- [ ] Click to insert
- [ ] Variable substitution works
- [ ] Can preview before inserting

---

### Task 8.3: ChatGPT Draft Integration (3 hours)

**File**: `app/api/email/draft/route.ts`

```typescript
import { OpenAI } from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  const { prompt, context } = await request.json()

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant drafting professional customer emails for a custom merchandise business.'
      },
      {
        role: 'user',
        content: `Draft an email for: ${prompt}\n\nContext: ${JSON.stringify(context)}`
      }
    ],
    temperature: 0.7,
  })

  return NextResponse.json({
    draft: completion.choices[0].message.content
  })
}
```

**Add to Email Composer**:
```typescript
<Button
  variant="outline"
  onClick={async () => {
    const draft = await fetch('/api/email/draft', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'follow up about their project',
        context: { customerName, projectTitle }
      })
    })
    setBody(draft.text)
  }}
>
  <Sparkles className="mr-2 h-4 w-4" />
  Draft with AI
</Button>
```

**Acceptance Criteria**:
- [ ] AI draft button in composer
- [ ] Uses customer/project context
- [ ] Generates professional email
- [ ] User can edit before sending
- [ ] Error handling

---

### Task 8.4: Testing & Refinement (2 hours)

- [ ] Test templates
- [ ] Test AI drafting
- [ ] Test variable substitution
- [ ] Refine AI prompts
- [ ] Add loading states

---

## Day 9: Quick Actions & Mobile Polish (8 hours)

### Task 9.1: Quick Note Modal (2 hours)

**File**: `components/notes/quick-note-dialog.tsx`

Floating action button that opens note dialog from anywhere.

**Acceptance Criteria**:
- [ ] FAB visible on customer/project pages
- [ ] Quick dialog to add note
- [ ] Associates with correct entity
- [ ] Saves to activity log

---

### Task 9.2: Call Links (1 hour)

Add `tel:` links everywhere phone numbers appear:

```typescript
{customer.phone && (
  <a href={`tel:${customer.phone}`} className="flex items-center gap-2">
    <Phone className="h-4 w-4" />
    {customer.phone}
  </a>
)}
```

**Acceptance Criteria**:
- [ ] Phone numbers clickable
- [ ] Opens phone dialer on mobile
- [ ] Works on customer cards
- [ ] Works on detail pages

---

### Task 9.3: Mobile Navigation Improvements (2 hours)

- [ ] Bottom navigation bar on mobile
- [ ] Swipe gestures for tabs
- [ ] Touch-optimized buttons (44px min)
- [ ] Improved mobile table (cards instead)

---

### Task 9.4: Search Improvements (3 hours)

**Global Search Modal**:
```typescript
// Cmd+K opens global search
// Searches customers, projects, orders
// Quick navigation
```

**Acceptance Criteria**:
- [ ] Cmd+K opens search
- [ ] Searches all entities
- [ ] Shows results grouped
- [ ] Click to navigate
- [ ] Keyboard navigation

---

## Day 10: Final Testing & Launch Prep (8 hours)

### Task 10.1: Comprehensive Testing (4 hours)

- [ ] Test every feature end-to-end
- [ ] Test on desktop, tablet, mobile
- [ ] Test in Chrome, Safari, Firefox
- [ ] Test with real data
- [ ] Performance testing
- [ ] Security review

---

### Task 10.2: Bug Fixes (2 hours)

- [ ] Fix any bugs found
- [ ] Polish rough edges
- [ ] Improve error messages
- [ ] Add missing loading states

---

### Task 10.3: Documentation & Training (2 hours)

**Create**:
- [ ] User guide
- [ ] Video walkthroughs
- [ ] Feature changelog
- [ ] Admin setup guide

**Update**:
- [ ] README
- [ ] SPRINT_PROGRESS.md
- [ ] Mark project as 100% complete

---

## Sprint 3 Deliverables ✅

**What Ships**:
1. ✅ Email template library
2. ✅ ChatGPT email drafting
3. ✅ Quick note modal
4. ✅ Call links (tel:)
5. ✅ Mobile navigation polish
6. ✅ Global search (Cmd+K)
7. ✅ Comprehensive documentation

**Business Value**:
- Faster email composition
- AI-assisted communication
- Mobile-first experience
- Power user features
- Professional appearance

**System Completeness**: 97% → 100%

---

# 📊 OVERALL SPRINT METRICS

## Timeline Summary

| Sprint | Days | Hours | Completion |
|--------|------|-------|------------|
| Sprint 1 | 3 | 24 | 85% → 92% |
| Sprint 2 | 4 | 32 | 92% → 97% |
| Sprint 3 | 3 | 24 | 97% → 100% |
| **Total** | **10** | **80** | **+15%** |

## Feature Count

**Sprint 1**: 6 major features
**Sprint 2**: 8 major features
**Sprint 3**: 7 major features
**Total**: 21 new features

## Business Value Delivered

**Sprint 1** (Critical):
- Revenue tracking (Shopify)
- Team coordination (Designer assignment)
- Deadline management (Event countdown)

**Sprint 2** (High Value):
- Professional UX (Status visual, Sorting)
- Efficiency (Filtering, Bulk actions)
- Scalability (Performance)

**Sprint 3** (Polish):
- Time savings (Templates, AI)
- Mobile experience
- Power features

---

# 🎯 SUCCESS CRITERIA

## Sprint 1 Complete When:
- [ ] Shopify orders display on customer page
- [ ] Can manually sync orders
- [ ] Can assign designers to projects
- [ ] "My Projects" filter works
- [ ] Event countdown shows with urgency colors
- [ ] "Needs Design" filter works

## Sprint 2 Complete When:
- [ ] Production status visual on project pages
- [ ] All tables sortable by clicking columns
- [ ] Advanced filter panel works with multiple filters
- [ ] Bulk selection and actions work
- [ ] Can bulk assign designers
- [ ] Can bulk update status

## Sprint 3 Complete When:
- [ ] Email templates available in composer
- [ ] AI drafting works
- [ ] Quick actions accessible
- [ ] Mobile experience polished
- [ ] Global search functional
- [ ] Documentation complete

## 100% Complete When:
- [ ] All acceptance criteria met
- [ ] All tests passing
- [ ] Performance targets met
- [ ] Documentation complete
- [ ] Deployed to production
- [ ] Team trained on new features

---

# 🚨 RISKS & MITIGATION

## Risk 1: Shopify API Complexity
**Mitigation**: Start simple (manual sync), add webhooks later

## Risk 2: Performance with Large Datasets
**Mitigation**: Test early, add pagination/virtualization if needed

## Risk 3: Scope Creep
**Mitigation**: Stick to sprint plan, defer nice-to-haves to backlog

## Risk 4: OpenAI API Costs
**Mitigation**: Add usage limits, rate limiting

## Risk 5: Testing Time Underestimated
**Mitigation**: Buffer built into each sprint

---

# 📝 DAILY STANDUP FORMAT

**What I did yesterday**:
**What I'm doing today**:
**Blockers**:
**% Complete on current task**:

---

# 🎉 LAUNCH CHECKLIST

After Sprint 3:
- [ ] All features tested
- [ ] Performance optimized
- [ ] Security reviewed
- [ ] Documentation complete
- [ ] Training materials ready
- [ ] Backup plan in place
- [ ] Monitoring set up
- [ ] Deploy to production
- [ ] Announce to team
- [ ] Celebrate! 🎊

---

**Ready to start Sprint 1?** Let's build!
