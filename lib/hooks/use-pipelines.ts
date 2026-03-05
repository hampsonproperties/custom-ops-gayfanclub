'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface SalesPipelineItem {
  id: string
  customer_name: string
  customer_email: string
  title: string
  status: string
  estimated_value: number | null
  assigned_to_email: string | null
  event_date: string | null
  next_follow_up_at: string | null
  last_activity_at: string | null
  is_overdue: boolean
  is_due_today: boolean
  tag_names: string[] | null
  tag_colors: string[] | null
  email_count: number
  latest_email_preview: string | null
  created_at: string
}

export interface ProductionPipelineItem {
  id: string
  customer_name: string
  customer_email: string
  title: string
  status: string
  event_date: string | null
  days_until_event: number | null
  tag_names: string[] | null
  tag_colors: string[] | null
  file_count: number
  created_at: string
}

export function useSalesPipeline() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['sales-pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_pipeline')
        .select('*')
        .order('last_activity_at', { ascending: false })

      if (error) throw error
      return data as SalesPipelineItem[]
    },
  })
}

export function useProductionPipeline() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['production-pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_pipeline')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as ProductionPipelineItem[]
    },
  })
}

// Organize sales pipeline by priority
export function useOrganizedSalesPipeline() {
  const { data: allLeads, ...rest } = useSalesPipeline()

  const organized = {
    overdue: allLeads?.filter(l => l.is_overdue) || [],
    newInquiries: allLeads?.filter(l => l.status === 'new_inquiry' && !l.is_overdue) || [],
    highValue: allLeads?.filter(l =>
      l.estimated_value && l.estimated_value >= 5000 &&
      !l.is_overdue && l.status !== 'new_inquiry'
    ) || [],
    active: allLeads?.filter(l =>
      !l.is_overdue &&
      l.status !== 'new_inquiry' &&
      (!l.estimated_value || l.estimated_value < 5000)
    ) || [],
  }

  return { data: organized, ...rest }
}

// Organize production pipeline by stage (no urgency - user decides if they can meet event date)
export function useOrganizedProductionPipeline() {
  const { data: allProjects, ...rest } = useProductionPipeline()

  const organized = {
    needsReview: allProjects?.filter(p =>
      p.status === 'needs_design_review'
    ) || [],
    readyForBatch: allProjects?.filter(p =>
      p.status.includes('ready_for_batch')
    ) || [],
    inProgress: allProjects?.filter(p =>
      p.status === 'batched' || p.status === 'in_progress' || p.status === 'in_transit'
    ) || [],
    recentlyShipped: allProjects?.filter(p =>
      p.status === 'shipped'
    ).slice(0, 5) || [], // Only show recent 5
  }

  return { data: organized, ...rest }
}
