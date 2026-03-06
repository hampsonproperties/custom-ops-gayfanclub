'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type SystemTemplate = Database['public']['Tables']['templates']['Row']
type SystemTemplateUpdate = Database['public']['Tables']['templates']['Update']

export type { SystemTemplate }

/**
 * Fetch all active system templates (proof approval + batch drip emails)
 */
export function useSystemTemplates() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['system-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error
      return data as SystemTemplate[]
    },
  })
}

/**
 * Update a system template's subject and body (key is read-only)
 */
export function useUpdateSystemTemplate() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: SystemTemplateUpdate }) => {
      const { data, error } = await supabase
        .from('templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-templates'] })
    },
  })
}
