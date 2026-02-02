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
        query = query.or(`customer_name.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%,title.ilike.%${filters.search}%`)
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
        .in('status', ['ready_for_batch', 'paid_ready_for_batch'])
        .is('batch_id', null)
        .or('status.eq.paid_ready_for_batch,shopify_financial_status.eq.paid')
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
