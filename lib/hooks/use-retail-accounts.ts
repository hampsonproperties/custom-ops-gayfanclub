'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

// Retail Account types (will be in Database types after migration)
interface RetailAccount {
  id: string
  account_name: string
  account_type: 'retailer' | 'corporate' | 'venue' | 'other'
  primary_contact_name: string | null
  primary_contact_email: string | null
  primary_contact_phone: string | null
  billing_email: string | null
  shopify_customer_id: string | null
  business_address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  website_url: string | null
  tax_id: string | null
  status: 'active' | 'inactive' | 'on_hold' | 'prospect'
  credit_limit: number | null
  payment_terms: string | null
  tags: string[]
  industry: string | null
  assigned_to_user_id: string | null
  assigned_at: string | null
  total_orders: number
  total_revenue: number
  last_order_date: string | null
  first_order_date: string | null
  internal_notes: string | null
  created_at: string
  updated_at: string
  created_by_user_id: string | null
}

type RetailAccountInsert = Omit<Partial<RetailAccount>, 'id' | 'created_at' | 'updated_at'> & {
  account_name: string
}

type RetailAccountUpdate = Partial<Omit<RetailAccount, 'id' | 'created_at' | 'updated_at'>>

interface RetailAccountsFilters {
  search?: string
  status?: string
  assignedTo?: string
}

export function useRetailAccounts(filters: RetailAccountsFilters = {}) {
  return useQuery({
    queryKey: ['retail-accounts', filters],
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      let query = supabase
        .from('retail_accounts')
        .select('*')
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      if (filters.assignedTo === 'me' && user) {
        query = query.eq('assigned_to_user_id', user.id)
      }

      if (filters.search) {
        query = query.or(
          `account_name.ilike.%${filters.search}%,primary_contact_email.ilike.%${filters.search}%,primary_contact_name.ilike.%${filters.search}%`
        )
      }

      const { data, error } = await query

      if (error) throw error
      return data as RetailAccount[]
    },
  })
}

export function useRetailAccount(id: string) {
  return useQuery({
    queryKey: ['retail-account', id],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('retail_accounts')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data as RetailAccount
    },
  })
}

export function useCreateRetailAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (account: RetailAccountInsert) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('retail_accounts')
        .insert({
          ...account,
          created_by_user_id: user?.id,
        })
        .select()
        .single()

      if (error) throw error
      return data as RetailAccount
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail-accounts'] })
    },
  })
}

export function useUpdateRetailAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: RetailAccountUpdate }) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('retail_accounts')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as RetailAccount
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['retail-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['retail-account', variables.id] })
    },
  })
}

export function useDeleteRetailAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('retail_accounts')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail-accounts'] })
    },
  })
}
