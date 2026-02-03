'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type Communication = Database['public']['Tables']['communications']['Row']
type CommunicationInsert = Database['public']['Tables']['communications']['Insert']
type CommunicationUpdate = Database['public']['Tables']['communications']['Update']
type EmailFilter = Database['public']['Tables']['email_filters']['Row']
type EmailFilterInsert = Database['public']['Tables']['email_filters']['Insert']
type EmailFilterUpdate = Database['public']['Tables']['email_filters']['Update']
type EmailCategory = Database['public']['Tables']['communications']['Row']['category']

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

export function useUntriagedEmails() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['communications', 'untriaged'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communications')
        .select('*')
        .eq('direction', 'inbound')
        .eq('triage_status', 'untriaged')
        .order('received_at', { ascending: false })

      if (error) throw error
      return data as Communication[]
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

export function useFlaggedSupportEmails() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['communications', 'support'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communications')
        .select('*')
        .eq('direction', 'inbound')
        .eq('triage_status', 'flagged_support')
        .order('received_at', { ascending: false })

      if (error) throw error
      return data as Communication[]
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
      const updates: CommunicationUpdate = {
        triage_status: triageStatus,
      }

      if (workItemId) {
        updates.work_item_id = workItemId
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications', 'untriaged'] })
      queryClient.invalidateQueries({ queryKey: ['communications', 'support'] })
      queryClient.invalidateQueries({ queryKey: ['communications'] })
    },
  })
}

export function useSendEmail() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({
      workItemId,
      to,
      subject,
      body,
      attachments,
      includeApprovalLink,
    }: {
      workItemId: string
      to: string
      subject: string
      body: string
      attachments?: string[]
      includeApprovalLink?: boolean
    }) => {
      // Send email via API endpoint (which calls Microsoft Graph)
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workItemId,
          to,
          subject,
          body,
          attachments,
          includeApprovalLink,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send email')
      }

      const result = await response.json()
      return result.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['communications'] })
      if (data.work_item_id) {
        queryClient.invalidateQueries({ queryKey: ['communications', data.work_item_id] })
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
  triageStatus?: 'untriaged' | 'triaged' | 'created_lead' | 'attached' | 'flagged_support' | 'archived'
) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['communications', 'category', category, triageStatus],
    queryFn: async () => {
      let query = supabase
        .from('communications')
        .select('*')
        .eq('direction', 'inbound')
        .eq('category', category)
        .neq('from_email', 'sales@thegayfanclub.com') // Exclude system-generated emails
        .order('received_at', { ascending: false })

      if (triageStatus) {
        query = query.eq('triage_status', triageStatus)
      }

      const { data, error } = await query

      if (error) throw error
      return data as Communication[]
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
// EMAIL FILTER HOOKS
// ============================================================================

/**
 * Query all active email filters
 */
export function useEmailFilters() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['email_filters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_filters')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as EmailFilter[]
    },
  })
}

/**
 * Create a new email filter
 */
export function useCreateEmailFilter() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (filter: EmailFilterInsert) => {
      const { data, error } = await supabase
        .from('email_filters')
        .insert(filter)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_filters'] })
    },
  })
}

/**
 * Update an existing email filter
 */
export function useUpdateEmailFilter() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: EmailFilterUpdate }) => {
      const { data, error } = await supabase
        .from('email_filters')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_filters'] })
    },
  })
}

/**
 * Delete (deactivate) an email filter
 */
export function useDeleteEmailFilter() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('email_filters')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_filters'] })
    },
  })
}
