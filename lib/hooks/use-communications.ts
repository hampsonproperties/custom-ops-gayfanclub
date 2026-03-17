'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type Communication = Database['public']['Tables']['communications']['Row']
type CommunicationInsert = Database['public']['Tables']['communications']['Insert']
type CommunicationUpdate = Database['public']['Tables']['communications']['Update']
type EmailCategory = 'primary' | 'promotional' | 'spam' | 'notifications'

export function useCommunications(workItemId?: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['communications', workItemId],
    queryFn: async () => {
      let query = supabase
        .from('communications')
        .select('*')
        .order('received_at', { ascending: false })

      if (workItemId) {
        query = query.eq('work_item_id', workItemId)
      }

      const { data, error } = await query

      if (error) throw error
      return data as Communication[]
    },
    enabled: workItemId !== undefined,
  })
}

export interface PaginatedCommsResult<T> {
  items: T[]
  totalCount: number
}

export function useUntriagedEmails(options?: { page?: number; pageSize?: number }) {
  const supabase = createClient()
  const isPaginated = options?.page !== undefined
  const pageSize = options?.pageSize ?? 25

  return useQuery({
    queryKey: ['communications', 'untriaged', options?.page, options?.pageSize],
    queryFn: async (): Promise<PaginatedCommsResult<Communication>> => {
      let query = supabase
        .from('communications')
        .select('*', isPaginated ? { count: 'exact' } : {})
        .eq('direction', 'inbound')
        .eq('triage_status', 'untriaged')
        .order('received_at', { ascending: false })

      if (isPaginated) {
        const from = (options!.page! - 1) * pageSize
        const to = from + pageSize - 1
        query = query.range(from, to)
      }

      const { data, error, count } = await query

      if (error) throw error
      return { items: (data ?? []) as Communication[], totalCount: count ?? data?.length ?? 0 }
    },
  })
}

export function useEmailThread(threadId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['communications', 'thread', threadId],
    queryFn: async () => {
      if (!threadId) return []

      const { data, error } = await supabase
        .from('communications')
        .select('*')
        .eq('provider_thread_id', threadId)
        .order('received_at', { ascending: false })

      if (error) throw error
      return data as Communication[]
    },
    enabled: !!threadId,
  })
}

export function useFlaggedSupportEmails(options?: { page?: number; pageSize?: number }) {
  const supabase = createClient()
  const isPaginated = options?.page !== undefined
  const pageSize = options?.pageSize ?? 25

  return useQuery({
    queryKey: ['communications', 'support', options?.page, options?.pageSize],
    queryFn: async (): Promise<PaginatedCommsResult<Communication>> => {
      let query = supabase
        .from('communications')
        .select('*', isPaginated ? { count: 'exact' } : {})
        .eq('direction', 'inbound')
        .eq('triage_status', 'flagged_support')
        .is('work_item_id', null)
        .order('received_at', { ascending: false })

      if (isPaginated) {
        const from = (options!.page! - 1) * pageSize
        const to = from + pageSize - 1
        query = query.range(from, to)
      }

      const { data, error, count } = await query

      if (error) throw error
      return { items: (data ?? []) as Communication[], totalCount: count ?? data?.length ?? 0 }
    },
  })
}

export function useCreateCommunication() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (communication: CommunicationInsert) => {
      const { data, error } = await supabase
        .from('communications')
        .insert(communication)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['communications'] })
      if (data.work_item_id) {
        queryClient.invalidateQueries({ queryKey: ['communications', data.work_item_id] })
      }
    },
  })
}

export function useUpdateCommunication() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: CommunicationUpdate }) => {
      const { data, error } = await supabase
        .from('communications')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['communications'] })
      if (data.work_item_id) {
        queryClient.invalidateQueries({ queryKey: ['communications', data.work_item_id] })
      }
    },
  })
}

export function useTriageEmail() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({
      id,
      triageStatus,
      workItemId,
    }: {
      id: string
      triageStatus: 'created_lead' | 'attached' | 'flagged_support' | 'archived'
      workItemId?: string
    }) => {
      // Auto-assign the triaging user as the email owner (feeds priority inbox)
      const { data: { user } } = await supabase.auth.getUser()

      const updates: CommunicationUpdate = {
        triage_status: triageStatus,
      }

      if (workItemId) {
        updates.work_item_id = workItemId
      }

      if (user) {
        updates.owner_user_id = user.id
      }

      const { data, error } = await supabase
        .from('communications')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['communications', 'untriaged'] })
      queryClient.invalidateQueries({ queryKey: ['communications', 'support'] })
      queryClient.invalidateQueries({ queryKey: ['communications'] })
      queryClient.invalidateQueries({ queryKey: ['my-inbox'] })
      // Invalidate the specific work item's communications if it was linked
      if (data.work_item_id) {
        queryClient.invalidateQueries({ queryKey: ['communications', data.work_item_id] })
      }
    },
  })
}

export function useSendEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectId,
      to,
      subject,
      body,
      customerId,
      cc,
      replyToMessageId,
    }: {
      projectId?: string
      to: string
      subject: string
      body: string
      customerId?: string
      cc?: string[]
      replyToMessageId?: string
    }) => {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          cc,
          subject,
          body,
          customerId,
          projectId,
          replyToMessageId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send email')
      }

      return { projectId }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['communications'] })
      if (variables.projectId) {
        queryClient.invalidateQueries({ queryKey: ['communications', variables.projectId] })
      }
      queryClient.invalidateQueries({ queryKey: ['work-items'] })
    },
  })
}

// ============================================================================
// EMAIL CATEGORIZATION HOOKS
// ============================================================================

/**
 * Query emails by category (primary, promotional, spam, notifications)
 * Optionally filter by triage_status
 * Excludes system emails (emails FROM the company's own email address)
 */
export function useEmailsByCategory(
  category: EmailCategory,
  triageStatus?: 'untriaged' | 'triaged' | 'created_lead' | 'attached' | 'flagged_support' | 'archived',
  options?: { page?: number; pageSize?: number; search?: string }
) {
  const supabase = createClient()
  const isPaginated = options?.page !== undefined
  const pageSize = options?.pageSize ?? 25

  return useQuery({
    queryKey: ['communications', 'category', category, triageStatus, options?.page, options?.pageSize, options?.search],
    queryFn: async (): Promise<PaginatedCommsResult<Communication>> => {
      let query = supabase
        .from('communications')
        .select('*', isPaginated ? { count: 'exact' } : {})
        .eq('direction', 'inbound')
        .eq('category', category)
        .is('work_item_id', null)
        .order('received_at', { ascending: false })

      if (triageStatus) {
        query = query.eq('triage_status', triageStatus)
      }

      if (options?.search?.trim()) {
        const s = options.search.trim()
        query = query.or(`from_email.ilike.%${s}%,subject.ilike.%${s}%,body_preview.ilike.%${s}%`)
      }

      if (isPaginated) {
        const from = (options!.page! - 1) * pageSize
        const to = from + pageSize - 1
        query = query.range(from, to)
      }

      const { data, error, count } = await query

      if (error) throw error
      return { items: (data ?? []) as Communication[], totalCount: count ?? data?.length ?? 0 }
    },
  })
}

/**
 * Get counts for all email categories
 * Optionally filter by triage_status
 * Excludes system emails (emails FROM the company's own email address)
 */
export function useEmailCategoryCounts(
  triageStatus?: 'untriaged' | 'triaged' | 'created_lead' | 'attached' | 'flagged_support' | 'archived'
) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['communications', 'category_counts', triageStatus],
    queryFn: async () => {
      let query = supabase
        .from('communications')
        .select('category, from_email')
        .eq('direction', 'inbound')
        .neq('from_email', 'sales@thegayfanclub.com') // Exclude system-generated emails
        .is('work_item_id', null) // Exclude emails linked to work items (those appear in Conversations)

      if (triageStatus) {
        query = query.eq('triage_status', triageStatus)
      }

      const { data, error } = await query

      if (error) throw error

      // Count emails by category
      const counts = {
        primary: 0,
        promotional: 0,
        spam: 0,
        notifications: 0,
      }

      data.forEach((item) => {
        if (!item.category) return
        const category = item.category as EmailCategory
        if (category in counts) {
          counts[category]++
        }
      })

      return counts
    },
  })
}

/**
 * Mark email as read or unread
 */
export function useMarkEmailAsRead() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ id, isRead }: { id: string; isRead: boolean }) => {
      const { data, error } = await supabase
        .from('communications')
        .update({ is_read: isRead })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] })
    },
  })
}

/**
 * Move email to a different category
 * Optionally creates a filter rule for the sender and applies it to ALL matching emails
 */
export function useMoveEmailToCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      emailId,
      category,
      createFilter,
      fromEmail,
    }: {
      emailId: string
      category: EmailCategory
      createFilter?: boolean
      fromEmail?: string
    }) => {
      // If creating a filter, use the API endpoint that moves ALL matching emails
      if (createFilter && fromEmail) {
        const response = await fetch('/api/email/move-with-filter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromEmail,
            category,
            createFilter: true,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to move emails with filter')
        }

        const result = await response.json()
        return result
      }

      // Otherwise, just move this single email (no filter creation)
      const supabase = createClient()
      const { data: email, error: emailError } = await supabase
        .from('communications')
        .update({ category })
        .eq('id', emailId)
        .select()
        .single()

      if (emailError) throw emailError
      return email
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] })
      queryClient.invalidateQueries({ queryKey: ['email_filters'] })
    },
  })
}

// ============================================================================
// PRIORITY INBOX HOOKS (Phase 1: PDR v3 Alignment)
// ============================================================================

/**
 * Query emails owned by the current user
 * Sorted by priority: high → medium → low
 * Filters out closed emails
 */
export function useMyInbox() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['communications', 'my-inbox'],
    queryFn: async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('communications')
        .select('*, work_items(id, title, status, customer_name, customer:customers(display_name, email, organization_name, phone))')
        .eq('owner_user_id', user.id)
        .neq('email_status', 'closed')
        .order('priority', { ascending: false }) // high first
        .order('received_at', { ascending: false })

      if (error) throw error
      return data as (Communication & { work_items: { id: string; title: string | null; status: string; customer_name: string | null; customer: { display_name: string | null; email: string | null; organization_name: string | null; phone: string | null } | null } | null })[]
    },
  })
}

/**
 * Reassign email ownership to another user
 */
export function useReassignEmail() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({
      emailId,
      newOwnerId
    }: {
      emailId: string
      newOwnerId: string
    }) => {
      const { data, error } = await supabase
        .from('communications')
        .update({ owner_user_id: newOwnerId })
        .eq('id', emailId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] })
    },
  })
}

/**
 * Update email priority and status
 */
export function useUpdateEmailPriority() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({
      emailId,
      priority,
      emailStatus
    }: {
      emailId: string
      priority?: 'high' | 'medium' | 'low'
      emailStatus?: 'needs_reply' | 'waiting_on_customer' | 'closed'
    }) => {
      const updates: CommunicationUpdate = {}
      if (priority) updates.priority = priority
      if (emailStatus) updates.email_status = emailStatus

      const { data, error } = await supabase
        .from('communications')
        .update(updates)
        .eq('id', emailId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] })
    },
  })
}

