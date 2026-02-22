import { createClient } from '@/lib/supabase/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type EmailCategory = 'primary' | 'promotional' | 'spam' | 'notifications'

export interface EmailFilter {
  id: string
  name: string
  filter_type: 'domain' | 'sender' | 'subject_keyword'
  pattern: string
  action: 'categorize' | 'block' | 'prioritize'
  target_category: EmailCategory
  description?: string
  is_active: boolean
  priority: number
  match_count: number
  last_matched_at?: string
  created_at: string
  updated_at: string
}

/**
 * Create an email filter from an email address
 * Automatically determines if it should be a sender or domain filter
 */
export function useCreateEmailFilter() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({
      email,
      category,
      useDomain = false,
    }: {
      email: string
      category: EmailCategory
      useDomain?: boolean
    }) => {
      const pattern = useDomain ? email.split('@')[1] : email
      const filterType = useDomain ? 'domain' : 'sender'
      const name = useDomain
        ? `Auto: ${email.split('@')[1]} → ${category}`
        : `Auto: ${email} → ${category}`

      const { data, error } = await supabase
        .from('email_filters')
        .insert({
          name,
          filter_type: filterType,
          pattern,
          action: 'categorize',
          target_category: category,
          description: `Automatically created filter`,
          is_active: true,
          priority: 50, // Medium priority for user-created filters
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-filters'] })
      queryClient.invalidateQueries({ queryKey: ['communications'] })
    },
  })
}

/**
 * Update email category for an existing communication
 * AND create a filter for future emails
 */
export function useRecategorizeEmail() {
  const queryClient = useQueryClient()
  const supabase = createClient()
  const createFilter = useCreateEmailFilter()

  return useMutation({
    mutationFn: async ({
      emailId,
      fromEmail,
      newCategory,
      applyToFuture = true,
      useDomain = false,
    }: {
      emailId: string
      fromEmail: string
      newCategory: EmailCategory
      applyToFuture?: boolean
      useDomain?: boolean
    }) => {
      // Update the current email's category
      const { error: updateError } = await supabase
        .from('communications')
        .update({ category: newCategory })
        .eq('id', emailId)

      if (updateError) throw updateError

      // Optionally create a filter for future emails
      if (applyToFuture) {
        await createFilter.mutateAsync({
          email: fromEmail,
          category: newCategory,
          useDomain,
        })
      }

      return { emailId, newCategory }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] })
      queryClient.invalidateQueries({ queryKey: ['email-filters'] })
    },
  })
}

/**
 * Get all email filters
 */
export function useEmailFilters() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['email-filters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_filters')
        .select('*')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as EmailFilter[]
    },
  })
}

/**
 * Delete an email filter
 */
export function useDeleteEmailFilter() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (filterId: string) => {
      const { error } = await supabase
        .from('email_filters')
        .delete()
        .eq('id', filterId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-filters'] })
    },
  })
}

/**
 * Toggle filter active status
 */
export function useToggleEmailFilter() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ filterId, isActive }: { filterId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('email_filters')
        .update({ is_active: isActive })
        .eq('id', filterId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-filters'] })
    },
  })
}
