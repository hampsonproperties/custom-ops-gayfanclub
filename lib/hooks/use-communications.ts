'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type Communication = Database['public']['Tables']['communications']['Row']
type CommunicationInsert = Database['public']['Tables']['communications']['Insert']
type CommunicationUpdate = Database['public']['Tables']['communications']['Update']

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
    }: {
      workItemId: string
      to: string
      subject: string
      body: string
    }) => {
      // Send email via API endpoint (which calls Microsoft Graph)
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workItemId, to, subject, body }),
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
    },
  })
}
