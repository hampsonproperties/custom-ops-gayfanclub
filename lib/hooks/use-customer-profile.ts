import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface CustomerProject {
  id: string
  type: string
  title: string
  status: string
  shopify_order_number: string | null
  event_date: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
}

export interface CustomerConversation {
  conversation_id: string
  work_item_id: string | null
  work_item_title: string | null
  work_item_status: string | null
  subject: string
  message_count: number
  last_message_at: string
  last_message_from: string | null
  last_message_direction: string | null
  has_unread: boolean
  conversation_status: string
  created_at: string
}

export interface CustomerProfileData {
  customer: {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    display_name: string | null
    phone: string | null
    shopify_customer_id: string | null
    created_at: string
  }
  projects: CustomerProject[]
  conversations: CustomerConversation[]
  stats: {
    total_projects: number
    active_projects: number
    completed_projects: number
    total_conversations: number
    unread_conversations: number
    total_spent: number
  }
}

/**
 * Fetch complete customer profile with projects and conversations
 * Implements CRM model: Customer → Projects → Conversations
 */
export function useCustomerProfile(customerId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['customer-profile', customerId],
    queryFn: async () => {
      if (!customerId) return null

      // Fetch customer data
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single()

      if (customerError) throw customerError

      // Fetch all projects (work items)
      const { data: projects, error: projectsError } = await supabase
        .from('work_items')
        .select('id, type, title, status, shopify_order_number, event_date, created_at, updated_at, closed_at')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      if (projectsError) throw projectsError

      // Fetch all conversations
      const { data: conversations, error: conversationsError } = await supabase
        .from('customer_conversations')
        .select('*')
        .eq('customer_id', customerId)
        .order('last_message_at', { ascending: false })

      if (conversationsError) throw conversationsError

      // Calculate stats
      const stats = {
        total_projects: projects?.length || 0,
        active_projects: projects?.filter((p) => !p.closed_at).length || 0,
        completed_projects: projects?.filter((p) => p.closed_at).length || 0,
        total_conversations: conversations?.length || 0,
        unread_conversations: conversations?.filter((c) => c.has_unread).length || 0,
        total_spent: 0, // TODO: Calculate from Shopify orders
      }

      return {
        customer,
        projects: projects || [],
        conversations: conversations || [],
        stats,
      } as CustomerProfileData
    },
    enabled: !!customerId,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })
}

/**
 * Fetch customer by email
 */
export function useCustomerByEmail(email: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['customer-by-email', email],
    queryFn: async () => {
      if (!email) return null

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('email', email.toLowerCase())
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return null
        }
        throw error
      }

      return data
    },
    enabled: !!email,
  })
}

/**
 * Fetch conversation messages
 */
export function useConversationMessages(conversationId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return []

      const { data, error } = await supabase
        .from('communications')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('received_at', { ascending: true })

      if (error) throw error
      return data
    },
    enabled: !!conversationId,
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
  })
}

/**
 * Mark conversation as read
 */
export async function markConversationAsRead(conversationId: string) {
  const supabase = createClient()

  const { error } = await supabase
    .from('conversations')
    .update({ has_unread: false })
    .eq('id', conversationId)

  if (error) throw error
}
