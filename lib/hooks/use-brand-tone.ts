'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

const DEFAULT_BRAND_TONE = `Playful. Powerful. Pride-forward.
Confident chaos, handled professionally.
Bold, inclusive, fast and friendly — like a cool founder texting you, not a help desk.
Short paragraphs. Occasional emoji. Zero corporate fluff.
Never snarky or mean. Always warm and enthusiastic.
Use "we" and "us" naturally. Sign off warmly but not formally.`

export { DEFAULT_BRAND_TONE }

export function useBrandTone() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['brand-tone'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'brand_tone')
        .single()

      if (error || !data) return DEFAULT_BRAND_TONE
      return (typeof data.value === 'string' ? data.value : DEFAULT_BRAND_TONE) as string
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — rarely changes
  })
}

export function useSaveBrandTone() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (tone: string) => {
      // Upsert: insert if not exists, update if exists
      const { error } = await supabase
        .from('settings')
        .upsert(
          {
            key: 'brand_tone',
            value: tone as any,
            description: 'Brand voice instructions used by all AI features (Polish, Suggest Reply)',
          },
          { onConflict: 'key' }
        )

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-tone'] })
    },
  })
}
