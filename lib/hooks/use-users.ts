'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface User {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
  created_at: string
}

export function useActiveUsers() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['active-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('full_name')

      if (error) throw error
      return data as User[]
    },
    staleTime: 5 * 60 * 1000, // 5 min — user list rarely changes
  })
}

export function useAllUsers() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('full_name')

      if (error) throw error
      return data as User[]
    },
    staleTime: 5 * 60 * 1000, // 5 min — user list rarely changes
  })
}
