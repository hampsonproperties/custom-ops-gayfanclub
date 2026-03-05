'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type QuickReplyTemplate = Database['public']['Tables']['quick_reply_templates']['Row']
type QuickReplyTemplateInsert = Database['public']['Tables']['quick_reply_templates']['Insert']
type QuickReplyTemplateUpdate = Database['public']['Tables']['quick_reply_templates']['Update']

export type { QuickReplyTemplate }

/**
 * Fetch all active quick reply templates, ordered by category then use_count
 */
export function useQuickReplyTemplates() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['quick-reply-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quick_reply_templates')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('use_count', { ascending: false, nullsFirst: false })

      if (error) throw error
      return data as QuickReplyTemplate[]
    },
  })
}

/**
 * Fetch ALL templates including inactive (for settings management)
 */
export function useAllQuickReplyTemplates() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['quick-reply-templates', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quick_reply_templates')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true })

      if (error) throw error
      return data as QuickReplyTemplate[]
    },
  })
}

/**
 * Create a new quick reply template
 */
export function useCreateTemplate() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (template: QuickReplyTemplateInsert) => {
      const { data, error } = await supabase
        .from('quick_reply_templates')
        .insert(template)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-reply-templates'] })
    },
  })
}

/**
 * Update an existing quick reply template
 */
export function useUpdateTemplate() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: QuickReplyTemplateUpdate }) => {
      const { data, error } = await supabase
        .from('quick_reply_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-reply-templates'] })
    },
  })
}

/**
 * Soft-delete a template (set is_active = false)
 */
export function useDeleteTemplate() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('quick_reply_templates')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-reply-templates'] })
    },
  })
}
