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
}

export function useWorkItems(filters?: WorkItemFilters) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['work-items', filters],
    queryFn: async () => {
      let query = supabase
        .from('work_items')
        .select('*, customer:customers(*)')
        .order('created_at', { ascending: false })

      if (filters?.type) {
        query = query.eq('type', filters.type)
      }
      if (filters?.status) {
        query = query.eq('status', filters.status)
      }
      if (filters?.assignedTo) {
        query = query.eq('assigned_to_user_id', filters.assignedTo)
      }
      if (filters?.search) {
        // Search across multiple fields:
        // - Customer info: name, email
        // - Order numbers: Shopify order #, design fee order #, raw order IDs
        // - Project: title
        // Note: alternate_emails search will be enabled after migration runs
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

      const { data, error } = await query

      if (error) throw error
      return data as WorkItem[]
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
        .select('*, customer:customers(*)')
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
  const supabase = createClient()

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
      const { data: { user } } = await supabase.auth.getUser()

      // Get current status
      const { data: workItem } = await supabase
        .from('work_items')
        .select('status')
        .eq('id', id)
        .single()

      // Update work item status
      const { data, error } = await supabase
        .from('work_items')
        .update({ status })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Create status event
      await supabase.from('work_item_status_events').insert({
        work_item_id: id,
        from_status: workItem?.status || null,
        to_status: status,
        changed_by_user_id: user?.id || null,
        note,
      })

      // Recalculate next follow-up after status change
      const { data: nextFollowUp } = await supabase
        .rpc('calculate_next_follow_up', { work_item_id: id })

      if (nextFollowUp !== undefined) {
        await supabase
          .from('work_items')
          .update({ next_follow_up_at: nextFollowUp })
          .eq('id', id)
      }

      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] })
      queryClient.invalidateQueries({ queryKey: ['work-item', data.id] })
      queryClient.invalidateQueries({ queryKey: ['status-events', data.id] })
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
      const { data, error } = await supabase
        .from('work_items')
        .select('*, customer:customers(*)')
        .lte('next_follow_up_at', `${today}T23:59:59`)
        .is('closed_at', null)
        .order('next_follow_up_at', { ascending: true })

      if (error) throw error
      return data as WorkItem[]
    },
  })
}

export function useOverdueFollowUps() {
  const supabase = createClient()
  const now = new Date().toISOString()

  return useQuery({
    queryKey: ['work-items', 'overdue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_items')
        .select('*, customer:customers(*)')
        .lt('next_follow_up_at', now)
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
        .select('*, customer:customers(*)')
        .eq('type', 'customify_order')
        .in('status', ['needs_design_review', 'needs_customer_fix'])
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as WorkItem[]
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
      const { data, error } = await supabase
        .from('work_items')
        .select('*, customer:customers(*)')
        .eq('type', 'assisted_project')
        .is('closed_at', null)
        .order('created_at', { ascending: false })

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
        .select('*, customer:customers(*)')
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
        .select('*, customer:customers(*)')
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
      const { data, error } = await supabase
        .from('work_items')
        .select('*, customer:customers(*)')
        .gt('next_follow_up_at', today.toISOString())
        .lte('next_follow_up_at', nextWeek.toISOString())
        .is('closed_at', null)
        .order('next_follow_up_at', { ascending: true })

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
