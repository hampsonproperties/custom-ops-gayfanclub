import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface StuckItem {
  work_item_id: string | null
  dlq_id: string | null
  item_type: string
  title: string | null
  customer_name: string | null
  customer_email: string | null
  status: string
  stuck_reason: string
  priority_score: number
  days_stuck: number
  created_at: string
  last_contact_at: string | null
  next_follow_up_at: string | null
}

export interface StuckItemsSummary {
  expired_approvals_count: number
  overdue_invoices_count: number
  awaiting_files_count: number
  design_review_count: number
  no_follow_up_count: number
  stale_items_count: number
  dlq_failures_count: number
  total_stuck_items: number
}

/**
 * Fetch all stuck items across all categories
 */
export function useStuckItems() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['stuck-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stuck_items_dashboard')
        .select('*')
        .order('priority_score', { ascending: false })
        .order('days_stuck', { ascending: false })

      if (error) throw error
      return data as StuckItem[]
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })
}

/**
 * Fetch stuck items summary counts
 */
export function useStuckItemsSummary() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['stuck-items-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stuck_items_summary')
        .select('*')
        .single()

      if (error) throw error
      return data as StuckItemsSummary
    },
    refetchInterval: 5 * 60 * 1000,
  })
}

/**
 * Fetch expired approvals only
 */
export function useExpiredApprovals() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['stuck-expired-approvals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stuck_expired_approvals')
        .select('*')
        .order('created_at')

      if (error) throw error
      return data
    },
    refetchInterval: 5 * 60 * 1000,
  })
}

/**
 * Fetch overdue invoices only
 */
export function useOverdueInvoices() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['stuck-overdue-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stuck_overdue_invoices')
        .select('*')
        .order('created_at')

      if (error) throw error
      return data
    },
    refetchInterval: 5 * 60 * 1000,
  })
}

/**
 * Fetch items awaiting files only
 */
export function useAwaitingFiles() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['stuck-awaiting-files'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stuck_awaiting_files')
        .select('*')
        .order('last_contact_at', { ascending: true, nullsFirst: true })

      if (error) throw error
      return data
    },
    refetchInterval: 5 * 60 * 1000,
  })
}

/**
 * Fetch DLQ failures only
 */
export function useDLQFailures() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['stuck-dlq-failures'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stuck_dlq_failures')
        .select('*')
        .order('created_at')

      if (error) throw error
      return data
    },
    refetchInterval: 2 * 60 * 1000, // More frequent for DLQ
  })
}

/**
 * Fetch items with no follow-up scheduled
 */
export function useNoFollowUpScheduled() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['stuck-no-follow-up'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stuck_no_follow_up')
        .select('*')
        .order('created_at')

      if (error) throw error
      return data
    },
    refetchInterval: 5 * 60 * 1000,
  })
}

/**
 * Fetch stale items
 */
export function useStaleItems() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['stuck-stale-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stuck_stale_items')
        .select('*')
        .order('updated_at')

      if (error) throw error
      return data
    },
    refetchInterval: 5 * 60 * 1000,
  })
}
