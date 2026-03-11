'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type WorkItem = Database['public']['Tables']['work_items']['Row']
type WorkItemInsert = Database['public']['Tables']['work_items']['Insert']
type WorkItemUpdate = Database['public']['Tables']['work_items']['Update']

interface WorkItemFilters {
  type?: string
  status?: string
  assignedTo?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  includeClosed?: boolean // Default false - only show open items
  neverBatched?: boolean
  page?: number
  pageSize?: number
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
}

export interface PaginatedResult<T> {
  items: T[]
  totalCount: number
}

export function useWorkItems(filters?: WorkItemFilters) {
  const supabase = createClient()
  const isPaginated = filters?.page !== undefined
  const pageSize = filters?.pageSize ?? 25

  return useQuery({
    queryKey: ['work-items', filters],
    queryFn: async (): Promise<PaginatedResult<WorkItem>> => {
      // Map UI sort columns to database columns
      const sortColumnMap: Record<string, string> = {
        name: 'customer_name',
        status: 'status',
        value: 'estimated_value',
        event_date: 'event_date',
        created: 'created_at',
      }
      const dbSortColumn = filters?.sortColumn ? (sortColumnMap[filters.sortColumn] || 'created_at') : 'created_at'
      const ascending = filters?.sortDirection === 'asc'

      let query = supabase
        .from('work_items')
        .select(
          '*, customer:customers(*), assigned_to:users!assigned_to_user_id(id, full_name, email)',
          isPaginated ? { count: 'exact' } : {}
        )
        .order(dbSortColumn, { ascending })

      // By default, only show open items (not closed)
      if (!filters?.includeClosed) {
        query = query.is('closed_at', null)
      }

      if (filters?.type) {
        query = query.eq('type', filters.type)
      }
      if (filters?.status) {
        query = query.eq('status', filters.status)
      }
      if (filters?.assignedTo) {
        // Handle "me" special case
        let assignedToUserId = filters.assignedTo
        if (filters.assignedTo === 'me') {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) throw new Error('Not authenticated')
          assignedToUserId = user.id
        }
        query = query.eq('assigned_to_user_id', assignedToUserId)
      }
      if (filters?.neverBatched) {
        query = query.is('batch_id', null)
      }
      if (filters?.search) {
        const searchTerm = filters.search.toLowerCase()
        query = query.or(
          `customer_name.ilike.%${searchTerm}%,` +
          `customer_email.ilike.%${searchTerm}%,` +
          `shopify_order_number.ilike.%${searchTerm}%,` +
          `design_fee_order_number.ilike.%${searchTerm}%,` +
          `shopify_order_id.ilike.%${searchTerm}%,` +
          `design_fee_order_id.ilike.%${searchTerm}%,` +
          `title.ilike.%${searchTerm}%`
        )
      }

      // Apply pagination range
      if (isPaginated) {
        const from = (filters!.page! - 1) * pageSize
        const to = from + pageSize - 1
        query = query.range(from, to)
      }

      const { data, error, count } = await query

      if (error) throw error

      // Fetch file counts for loaded work items
      let items = (data ?? []) as WorkItem[]
      if (items.length > 0) {
        const workItemIds = items.map(item => item.id)
        const { data: fileCounts } = await supabase
          .from('files')
          .select('work_item_id')
          .in('work_item_id', workItemIds)

        const fileCountMap = new Map<string, number>()
        fileCounts?.forEach((file: any) => {
          const current = fileCountMap.get(file.work_item_id) || 0
          fileCountMap.set(file.work_item_id, current + 1)
        })

        items = items.map((item: any) => ({
          ...item,
          file_count: fileCountMap.get(item.id) || 0
        }))
      }

      return { items, totalCount: count ?? items.length }
    },
  })
}

export function useWorkItem(id: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['work-item', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_items')
        .select('*, customer:customers(*), assigned_to:users!assigned_to_user_id(id, full_name, email)')
        .eq('id', id)
        .single()

      if (error) throw error
      return data as WorkItem
    },
    enabled: !!id,
  })
}

export function useCreateWorkItem() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (workItem: WorkItemInsert) => {
      const { data, error } = await supabase
        .from('work_items')
        .insert(workItem)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] })
    },
  })
}

/**
 * Create a lead from an email via the /api/leads endpoint.
 * Unlike useCreateWorkItem (which inserts directly), this:
 *   - Finds or creates a customer record (links lead to CRM)
 *   - Records who created the lead (created_by_user_id for timeline)
 */
export function useCreateLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (workItem: WorkItemInsert) => {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workItem),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create lead')
      }

      const result = await response.json()
      return result.data as WorkItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['morning-briefing'] })
    },
  })
}

export function useUpdateWorkItem() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: WorkItemUpdate }) => {
      const { data, error } = await supabase
        .from('work_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] })
      queryClient.invalidateQueries({ queryKey: ['work-item', data.id] })
    },
  })
}

export function useUpdateWorkItemStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      status,
      note,
    }: {
      id: string
      status: string
      note?: string
    }) => {
      // Route through the API which validates transitions,
      // uses atomic RPC with row locking, and creates audit trail
      const response = await fetch(`/api/projects/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update status')
      }

      return { id }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] })
      queryClient.invalidateQueries({ queryKey: ['work-item', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['status-events', variables.id] })
    },
  })
}

// Derived queries for specific views
export function useFollowUpToday() {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  return useQuery({
    queryKey: ['work-items', 'follow-up-today'],
    queryFn: async () => {
      // Only show sales pipeline statuses (not active design work)
      // Only today's follow-ups (not overdue from previous days)
      const { data, error} = await supabase
        .from('work_items')
        .select('*, customer:customers(*)')
        .gte('next_follow_up_at', `${today}T00:00:00`)
        .lte('next_follow_up_at', `${today}T23:59:59`)
        .in('status', ['new_inquiry', 'quote_sent', 'design_fee_sent', 'invoice_sent', 'awaiting_payment'])
        .is('closed_at', null)
        .order('next_follow_up_at', { ascending: true })

      if (error) throw error
      return data as WorkItem[]
    },
  })
}

export function useOverdueFollowUps() {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  return useQuery({
    queryKey: ['work-items', 'overdue'],
    queryFn: async () => {
      // Only show sales pipeline statuses (not active design work)
      // Only items from before today (today's items are in useFollowUpToday)
      const { data, error } = await supabase
        .from('work_items')
        .select('*, customer:customers(*)')
        .lt('next_follow_up_at', `${today}T00:00:00`)
        .in('status', ['new_inquiry', 'quote_sent', 'design_fee_sent', 'invoice_sent', 'awaiting_payment'])
        .is('closed_at', null)
        .order('next_follow_up_at', { ascending: true })

      if (error) throw error
      return data as WorkItem[]
    },
  })
}

export function useDesignReviewQueue() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['work-items', 'design-review-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_items')
        .select('*, customer:customers(*), files(id, external_url, storage_bucket, storage_path, original_filename, kind, mime_type, size_bytes)')
        .eq('type', 'customify_order')
        .in('status', ['needs_design_review', 'needs_customer_fix'])
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as (WorkItem & { files: Array<{ id: string; external_url: string | null; storage_bucket: string | null; storage_path: string | null; original_filename: string; kind: string; mime_type: string; size_bytes: number }> })[]
    },
  })
}

export function useReadyForBatch() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['work-items', 'ready-for-batch'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_items')
        .select('*, customer:customers(*)')
        .in('status', ['approved', 'ready_for_batch', 'deposit_paid_ready_for_batch', 'on_payment_terms_ready_for_batch', 'paid_ready_for_batch'])
        .is('batch_id', null)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as WorkItem[]
    },
  })
}

// Custom Design Projects hooks
export function useCustomDesignProjects() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['work-items', 'custom-design-all'],
    queryFn: async () => {
      // Only show in-progress design work (not sales pipeline)
      const { data, error } = await supabase
        .from('work_items')
        .select('*, customer:customers(*)')
        .eq('type', 'assisted_project')
        .in('status', ['designing', 'proof_sent', 'awaiting_approval', 'customer_providing_artwork'])
        .is('closed_at', null)
        .order('created_at', { ascending: false})

      if (error) throw error
      return data as WorkItem[]
    },
  })
}

export function useCustomDesignDesigning() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['work-items', 'custom-design-designing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_items')
        .select('*, customer:customers(*)')
        .eq('type', 'assisted_project')
        .in('status', ['design_fee_paid', 'in_design'])
        .is('closed_at', null)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as WorkItem[]
    },
  })
}

export function useCustomDesignAwaitingApproval() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['work-items', 'custom-design-awaiting-approval'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_items')
        .select('*, customer:customers(*), status_events:work_item_status_events(created_at, to_status)')
        .eq('type', 'assisted_project')
        .in('status', ['proof_sent', 'awaiting_approval'])
        .is('closed_at', null)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as WorkItem[]
    },
  })
}

export function useCustomDesignAwaitingPayment() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['work-items', 'custom-design-awaiting-payment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_items')
        .select('*, customer:customers(*), status_events:work_item_status_events(created_at, to_status)')
        .eq('type', 'assisted_project')
        .eq('status', 'invoice_sent')
        .is('closed_at', null)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as WorkItem[]
    },
  })
}

// ============================================================================
// FOLLOW-UP MANAGEMENT HOOKS
// ============================================================================

// Inbox replies (unactioned inbound emails)
export function useInboxReplies() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['inbox-replies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communications')
        .select('*, work_item:work_items(*)')
        .eq('direction', 'inbound')
        .is('actioned_at', null)
        .not('work_item_id', 'is', null)
        .order('received_at', { ascending: false })

      if (error) throw error
      return data
    },
  })
}

// Needs initial contact (Shopify-first orders)
export function useNeedsInitialContact() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['work-items', 'needs-initial-contact'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_items')
        .select('*, customer:customers(*)')
        .eq('requires_initial_contact', true)
        .is('closed_at', null)
        .in('status', ['new_inquiry', 'quote_sent', 'design_fee_sent', 'invoice_sent', 'awaiting_payment']) // Sales statuses only
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as WorkItem[]
    },
  })
}

// Rush orders (event <30 days)
export function useRushOrders() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['work-items', 'rush-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_items')
        .select('*, customer:customers(*)')
        .eq('rush_order', true)
        .is('closed_at', null)
        .in('status', ['new_inquiry', 'quote_sent', 'design_fee_sent', 'invoice_sent', 'awaiting_payment']) // Sales statuses only
        .order('event_date', { ascending: true })

      if (error) throw error
      return data as WorkItem[]
    },
  })
}

// Due this week
export function useDueThisWeek() {
  const supabase = createClient()
  const today = new Date()
  const nextWeek = new Date(today)
  nextWeek.setDate(today.getDate() + 7)

  return useQuery({
    queryKey: ['work-items', 'due-this-week'],
    queryFn: async () => {
      // Only show sales pipeline statuses (not active design work)
      const { data, error } = await supabase
        .from('work_items')
        .select('*, customer:customers(*)')
        .gt('next_follow_up_at', today.toISOString())
        .lte('next_follow_up_at', nextWeek.toISOString())
        .in('status', ['new_inquiry', 'quote_sent', 'design_fee_sent', 'invoice_sent', 'awaiting_payment'])
        .is('closed_at', null)
        .order('next_follow_up_at', { ascending: true})

      if (error) throw error
      return data as WorkItem[]
    },
  })
}

// Waiting on customer
export function useWaitingOnCustomer() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['work-items', 'waiting-on-customer'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_items')
        .select('*, customer:customers(*)')
        .eq('is_waiting', true)
        .is('closed_at', null)
        .in('status', ['new_inquiry', 'quote_sent', 'design_fee_sent', 'invoice_sent', 'awaiting_payment']) // Sales statuses only
        .order('updated_at', { ascending: false })

      if (error) throw error
      return data as WorkItem[]
    },
  })
}

// Mark work item as followed up
export function useMarkFollowedUp() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (workItemId: string) => {
      const response = await fetch(`/api/work-items/${workItemId}/mark-followed-up`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to mark followed up')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] })
    },
  })
}

// Snooze follow-up
export function useSnoozeFollowUp() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ workItemId, days }: { workItemId: string; days: number }) => {
      const response = await fetch(`/api/work-items/${workItemId}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      })
      if (!response.ok) throw new Error('Failed to snooze')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] })
    },
  })
}

// Toggle waiting status
export function useToggleWaiting() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (workItemId: string) => {
      const response = await fetch(`/api/work-items/${workItemId}/toggle-waiting`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to toggle waiting')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] })
    },
  })
}

// Mark communication as actioned
export function useMarkCommunicationActioned() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (communicationId: string) => {
      const response = await fetch(`/api/communications/${communicationId}/mark-actioned`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to mark actioned')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-replies'] })
      queryClient.invalidateQueries({ queryKey: ['work-items'] })
    },
  })
}

// Close work item (archive/cancel) with auto-sync to customer sales stage
export function useCloseWorkItem() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  // Map close reasons to valid workflow statuses
  const reasonToStatus: Record<string, string> = {
    won: 'closed_won',
    completed: 'closed_won',
    missed_deadline: 'closed_lost',
    too_expensive: 'closed_lost',
    ghosted: 'closed_lost',
    went_with_competitor: 'closed_lost',
    not_ready_yet: 'closed_lost',
    not_interested: 'closed_lost',
    cancelled: 'closed_event_cancelled',
    spam: 'closed',
    other: 'closed',
  }

  // Map close reasons to customer sales stages
  const reasonToCustomerStage: Record<string, string> = {
    won: 'active_customer',
    completed: 'active_customer',
    missed_deadline: 'lost',
    too_expensive: 'lost',
    ghosted: 'lost',
    went_with_competitor: 'lost',
    not_ready_yet: 'lost',
    not_interested: 'lost',
    cancelled: 'lost',
  }

  return useMutation({
    mutationFn: async ({
      workItemId,
      reason,
      customerId,
    }: {
      workItemId: string
      reason: string
      customerId?: string
    }) => {
      // Close the work item
      const { error } = await supabase
        .from('work_items')
        .update({
          closed_at: new Date().toISOString(),
          close_reason: reason,
          status: reasonToStatus[reason] || 'closed',
        })
        .eq('id', workItemId)

      if (error) throw error

      // Auto-sync customer sales stage if we have a customerId and a mapped stage
      const customerStage = reasonToCustomerStage[reason]
      if (customerId && customerStage) {
        // Only update if customer doesn't have a "better" stage already
        // (don't downgrade active_customer to lost if they have other open projects)
        if (customerStage === 'lost') {
          // Check if customer has other open work items
          const { data: openItems } = await supabase
            .from('work_items')
            .select('id')
            .eq('customer_id', customerId)
            .is('closed_at', null)
            .neq('id', workItemId)
            .limit(1)

          // Only set to lost if no other open projects
          if (!openItems || openItems.length === 0) {
            await supabase
              .from('customers')
              .update({ sales_stage: customerStage })
              .eq('id', customerId)
          }
        } else {
          // Won — always upgrade to active_customer
          await supabase
            .from('customers')
            .update({ sales_stage: customerStage })
            .eq('id', customerId)
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] })
      queryClient.invalidateQueries({ queryKey: ['customer-profile'] })
      queryClient.invalidateQueries({ queryKey: ['morning-briefing'] })
    },
  })
}
