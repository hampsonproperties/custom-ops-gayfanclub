'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useAutoEmailsSetting() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['auto-emails-enabled'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'auto_emails_enabled')
        .single()

      if (error || !data) return false
      return data.value === true || data.value === 'true'
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useToggleAutoEmails() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('settings')
        .upsert(
          {
            key: 'auto_emails_enabled',
            value: enabled as any,
            description: 'Global toggle for automatic customer-facing emails (drip sequences, batch emails)',
          },
          { onConflict: 'key' }
        )

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-emails-enabled'] })
    },
  })
}
