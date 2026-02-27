import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export type LeadStatus =
  | 'new_inquiry'
  | 'info_sent'
  | 'future_event_monitoring'
  | 'design_fee_sent'
  | 'design_fee_paid'
  | 'closed_won'
  | 'closed_lost'
  | 'closed_event_cancelled'

export interface Lead {
  id: string
  customer_name: string | null
  customer_email: string | null
  company_name: string | null
  phone_number: string | null
  status: LeadStatus
  estimated_value: number | null
  actual_value: number | null
  event_date: string | null
  lead_source: string | null
  assigned_to_user_id: string | null
  assigned_to_email: string | null
  shopify_customer_id: string | null
  shopify_order_id: string | null
  design_fee_order_id: string | null
  created_at: string
  updated_at: string
  last_contact_at: string | null
  next_follow_up_at: string | null
}

export interface LeadsFilters {
  assignedTo?: 'me' | 'all' | 'unassigned' | string
  status?: LeadStatus | 'all'
  leadSource?: string | 'all'
  search?: string
}

export function useLeads(filters: LeadsFilters = {}) {
  return useQuery({
    queryKey: ['leads', filters],
    queryFn: async () => {
      const supabase = createClient()

      // Get current user for "my leads" filter
      const { data: { user } } = await supabase.auth.getUser()

      let query = supabase
        .from('work_items')
        .select('*')
        .eq('type', 'assisted_project')
        .in('status', [
          'new_inquiry',
          'info_sent',
          'future_event_monitoring',
          'design_fee_sent',
          'design_fee_paid',
          'closed_won',
          'closed_lost',
          'closed_event_cancelled',
        ])
        .order('created_at', { ascending: false })

      // Filter by assignment
      if (filters.assignedTo === 'me' && user) {
        query = query.eq('assigned_to_user_id', user.id)
      } else if (filters.assignedTo === 'unassigned') {
        query = query.is('assigned_to_user_id', null)
      } else if (filters.assignedTo && filters.assignedTo !== 'all') {
        query = query.eq('assigned_to_user_id', filters.assignedTo)
      }

      // Filter by status
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }

      // Filter by lead source
      if (filters.leadSource && filters.leadSource !== 'all') {
        query = query.eq('lead_source', filters.leadSource)
      }

      // Search by name or email
      if (filters.search) {
        query = query.or(
          `customer_name.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%`
        )
      }

      const { data, error } = await query

      if (error) throw error

      return data as Lead[]
    },
  })
}

export function useLeadStats() {
  return useQuery({
    queryKey: ['lead-stats'],
    queryFn: async () => {
      const supabase = createClient()

      // Get total leads
      const { count: totalLeads } = await supabase
        .from('work_items')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'assisted_project')
        .in('status', [
          'new_inquiry',
          'info_sent',
          'future_event_monitoring',
          'design_fee_sent',
          'design_fee_paid',
        ])

      // Get won leads
      const { count: wonLeads } = await supabase
        .from('work_items')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'assisted_project')
        .eq('status', 'closed_won')

      // Get total estimated value
      const { data: valueData } = await supabase
        .from('work_items')
        .select('estimated_value')
        .eq('type', 'assisted_project')
        .in('status', [
          'new_inquiry',
          'info_sent',
          'future_event_monitoring',
          'design_fee_sent',
          'design_fee_paid',
        ])
        .not('estimated_value', 'is', null)

      const totalValue = valueData?.reduce((sum, item) => sum + (item.estimated_value || 0), 0) || 0

      // Get total revenue (won leads)
      const { data: revenueData } = await supabase
        .from('work_items')
        .select('actual_value')
        .eq('type', 'assisted_project')
        .eq('status', 'closed_won')
        .not('actual_value', 'is', null)

      const totalRevenue = revenueData?.reduce((sum, item) => sum + (item.actual_value || 0), 0) || 0

      return {
        totalLeads: totalLeads || 0,
        wonLeads: wonLeads || 0,
        totalValue,
        totalRevenue,
        conversionRate: totalLeads && wonLeads ? ((wonLeads / totalLeads) * 100).toFixed(1) : '0',
      }
    },
  })
}
