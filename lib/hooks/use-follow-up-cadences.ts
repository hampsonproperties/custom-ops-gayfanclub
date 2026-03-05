'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type FollowUpCadence = Database['public']['Tables']['follow_up_cadences']['Row']
type FollowUpCadenceUpdate = Database['public']['Tables']['follow_up_cadences']['Update']

export type { FollowUpCadence }

/**
 * Fetch all follow-up cadence rules, ordered by type then priority
 */
export function useFollowUpCadences() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['follow-up-cadences'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follow_up_cadences')
        .select('*')
        .order('work_item_type', { ascending: true })
        .order('priority', { ascending: false })

      if (error) throw error
      return data as FollowUpCadence[]
    },
  })
}

/**
 * Update a single cadence rule (interval, active, business days, pauses)
 */
export function useUpdateFollowUpCadence() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: FollowUpCadenceUpdate }) => {
      const { data, error } = await supabase
        .from('follow_up_cadences')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-cadences'] })
    },
  })
}
