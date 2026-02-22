'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface WorkItemNote {
  id: string
  work_item_id: string
  content: string
  author_email: string
  created_at: string
  updated_at: string
}

export function useNotes(workItemId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['notes', workItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_item_notes')
        .select('*')
        .eq('work_item_id', workItemId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as WorkItemNote[]
    },
    enabled: !!workItemId,
  })
}

export function useCreateNote() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({
      workItemId,
      content,
    }: {
      workItemId: string
      content: string
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('work_item_notes')
        .insert({
          work_item_id: workItemId,
          content,
          author_email: user.email,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notes', variables.workItemId] })
      queryClient.invalidateQueries({ queryKey: ['work-item', variables.workItemId] })
    },
  })
}

export function useUpdateNote() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({
      noteId,
      content,
      workItemId,
    }: {
      noteId: string
      content: string
      workItemId: string
    }) => {
      const { data, error } = await supabase
        .from('work_item_notes')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', noteId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notes', variables.workItemId] })
    },
  })
}

export function useDeleteNote() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({
      noteId,
      workItemId,
    }: {
      noteId: string
      workItemId: string
    }) => {
      const { error } = await supabase
        .from('work_item_notes')
        .delete()
        .eq('id', noteId)

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notes', variables.workItemId] })
    },
  })
}
