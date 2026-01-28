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
      // Create communication record
      const { data, error } = await supabase
        .from('communications')
        .insert({
          work_item_id: workItemId,
          direction: 'outbound',
          from_email: 'custom@thegayfanclub.com',
          to_emails: [to],
          subject,
          body_html: body,
          body_preview: body.substring(0, 200),
          sent_at: new Date().toISOString(),
          triage_status: 'triaged',
        })
        .select()
        .single()

      if (error) throw error

      // TODO: Actually send via Microsoft Graph API
      // For now, just log to database

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
