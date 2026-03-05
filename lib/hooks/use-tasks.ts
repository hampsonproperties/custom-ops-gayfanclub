'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface Task {
  id: string
  title: string
  description: string | null
  due_date: string | null
  assigned_to_user_id: string | null
  customer_id: string | null
  work_item_id: string | null
  created_by_user_id: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  assigned_to?: { id: string; full_name: string | null; email: string } | null
  created_by?: { full_name: string | null } | null
}

interface UseTasksOptions {
  workItemId?: string
  customerId?: string
}

export function useTasks({ workItemId, customerId }: UseTasksOptions) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['tasks', { workItemId, customerId }],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          assigned_to:users!tasks_assigned_to_user_id_fkey(id, full_name, email),
          created_by:users!tasks_created_by_user_id_fkey(full_name)
        `)
        .order('completed_at', { ascending: true, nullsFirst: true })
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (workItemId) {
        query = query.eq('work_item_id', workItemId)
      }
      if (customerId) {
        query = query.eq('customer_id', customerId)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Task[]
    },
    enabled: !!(workItemId || customerId),
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (input: {
      title: string
      description?: string
      due_date?: string
      assigned_to_user_id?: string
      work_item_id?: string
      customer_id?: string
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          ...input,
          created_by_user_id: user.id,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useToggleTask() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq('id', taskId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ taskId }: { taskId: string }) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
