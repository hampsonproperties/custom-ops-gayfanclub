import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface CustomerContact {
  id: string
  customer_id: string
  full_name: string
  email: string | null
  phone: string | null
  role: string | null
  title: string | null
  is_primary: boolean
  receives_emails: boolean
  receives_invoices: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export function useCustomerContacts(customerId: string) {
  return useQuery({
    queryKey: ['customer-contacts', customerId],
    queryFn: async () => {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('customer_contacts')
        .select('*')
        .eq('customer_id', customerId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as CustomerContact[]
    },
    enabled: !!customerId,
  })
}

export function useAddCustomerContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (contact: Omit<CustomerContact, 'id' | 'created_at' | 'updated_at'>) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('customer_contacts')
        .insert({
          ...contact,
          created_by_user_id: user?.id,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-contacts', variables.customer_id] })
    },
  })
}

export function useUpdateCustomerContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      customerId,
      updates,
    }: {
      id: string
      customerId: string
      updates: Partial<CustomerContact>
    }) => {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('customer_contacts')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-contacts', variables.customerId] })
    },
  })
}

export function useDeleteCustomerContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, customerId }: { id: string; customerId: string }) => {
      const supabase = createClient()

      const { error } = await supabase.from('customer_contacts').delete().eq('id', id)

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-contacts', variables.customerId] })
    },
  })
}
