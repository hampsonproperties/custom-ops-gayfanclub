'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  useOrganizedSalesPipeline,
  useOrganizedProductionPipeline,
} from '@/lib/hooks/use-pipelines'
import { useUntriagedEmails } from '@/lib/hooks/use-communications'
import { useMyTasks, useToggleTask, type Task } from '@/lib/hooks/use-tasks'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  AlertCircle,
  Mail,
  DollarSign,
  MessageSquare,
  Package,
  Palette,
  CheckCircle,
  Truck,
  Calendar,
  ListTodo,
  Circle,
  Clock,
  ArrowRight,
  Inbox,
  Send,
  CheckCircle2,
  UserCheck,
  AlertTriangle,
  RefreshCw,
  Sun,
  PackageCheck,
  RotateCcw,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { scoreCustomerHealth, scoreLeadHealth } from '@/lib/utils/health-scoring'
import { setQueue } from '@/lib/hooks/use-queue-navigation'
import { HealthDot } from '@/components/custom/health-badge'

// Helper: fetch IDs of customers with at least one open assisted project or sales lead
// Excludes customify orders — those are self-service and don't need email tracking
async function getCustomersWithOpenProjects(supabase: any): Promise<Set<string>> {
  const { data } = await supabase
    .from('work_items')
    .select('customer_id')
    .is('closed_at', null)
    .not('customer_id', 'is', null)
    .neq('type', 'customify_order')
  return new Set((data || []).map((w: any) => w.customer_id))
}

// Hook: fetch customers needing my reply (last_inbound_at > last_outbound_at)
// Only shows customers with open projects — excludes fulfilled/Customify-only
function useNeedsMyReply() {
  return useQuery({
    queryKey: ['morning-briefing', 'needs-my-reply'],
    queryFn: async () => {
      const supabase = createClient()
      const [{ data, error }, activeCustomerIds] = await Promise.all([
        supabase
          .from('customers')
          .select('id, email, first_name, last_name, display_name, organization_name, customer_type, last_inbound_at, last_outbound_at')
          .not('last_inbound_at', 'is', null)
          .order('last_inbound_at', { ascending: true })
          .limit(200),
        getCustomersWithOpenProjects(supabase),
      ])

      if (error) throw error
      // Filter: inbound is more recent than outbound, and customer has open projects
      return (data || []).filter(c => {
        if (!activeCustomerIds.has(c.id)) return false
        if (!c.last_outbound_at) return true
        return new Date(c.last_inbound_at!) > new Date(c.last_outbound_at)
      }).slice(0, 10)
    },
    refetchInterval: 5 * 60 * 1000,
  })
}

// Hook: fetch customers waiting on response (last_outbound_at > last_inbound_at, 2+ days)
// Only shows customers with open projects — excludes fulfilled/Customify-only
function useWaitingOnCustomer() {
  return useQuery({
    queryKey: ['morning-briefing', 'waiting-on-customer'],
    queryFn: async () => {
      const supabase = createClient()
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      const [{ data, error }, activeCustomerIds] = await Promise.all([
        supabase
          .from('customers')
          .select('id, email, first_name, last_name, display_name, organization_name, customer_type, last_inbound_at, last_outbound_at')
          .not('last_outbound_at', 'is', null)
          .lt('last_outbound_at', twoDaysAgo)
          .order('last_outbound_at', { ascending: true })
          .limit(200),
        getCustomersWithOpenProjects(supabase),
      ])

      if (error) throw error
      // Filter: outbound is more recent than inbound, and customer has open projects
      return (data || []).filter(c => {
        if (!activeCustomerIds.has(c.id)) return false
        if (!c.last_inbound_at) return true
        return new Date(c.last_outbound_at!) > new Date(c.last_inbound_at)
      }).slice(0, 10)
    },
    refetchInterval: 5 * 60 * 1000,
  })
}

// Hook: fetch overdue and due-today follow-ups
function useFollowUpsBriefing() {
  return useQuery({
    queryKey: ['morning-briefing', 'follow-ups'],
    queryFn: async () => {
      const supabase = createClient()
      const now = new Date()
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

      const { data, error } = await supabase
        .from('work_items')
        .select('id, title, status, customer_name, customer_email, next_follow_up_at, event_date, estimated_value, customer:customers(display_name, email, organization_name)')
        .is('closed_at', null)
        .not('next_follow_up_at', 'is', null)
        .lte('next_follow_up_at', endOfToday)
        .order('next_follow_up_at', { ascending: true })
        .limit(10)

      if (error) throw error
      return data || []
    },
    refetchInterval: 5 * 60 * 1000,
  })
}

// Hook: fetch customers with follow-up dates due today or overdue
function useCustomerCheckIns() {
  return useQuery({
    queryKey: ['morning-briefing', 'customer-check-ins'],
    queryFn: async () => {
      const supabase = createClient()
      const endOfToday = new Date()
      endOfToday.setHours(23, 59, 59, 999)

      const { data, error } = await supabase
        .from('customers')
        .select('id, email, first_name, last_name, display_name, organization_name, customer_type, next_follow_up_at, follow_up_reason, follow_up_touch_number, follow_up_max_touches')
        .not('next_follow_up_at', 'is', null)
        .lte('next_follow_up_at', endOfToday.toISOString())
        .order('next_follow_up_at', { ascending: true })
        .limit(20)

      if (error) throw error
      return data || []
    },
    refetchInterval: 5 * 60 * 1000,
  })
}

// Hook: fetch retailers/organizations who haven't ordered in 60+ days
// Excludes Customify-only customers
function useRetailReorders() {
  return useQuery({
    queryKey: ['morning-briefing', 'retail-reorders'],
    queryFn: async () => {
      const supabase = createClient()
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

      // Get retailers and organizations with orders older than 60 days
      const { data: customers, error } = await supabase
        .from('customers')
        .select('id, email, first_name, last_name, display_name, organization_name, customer_type, last_order_date, total_order_count')
        .in('customer_type', ['retailer', 'organization'])
        .not('last_order_date', 'is', null)
        .lt('last_order_date', sixtyDaysAgo)
        .order('last_order_date', { ascending: true })
        .limit(20)

      if (error) throw error
      if (!customers || customers.length === 0) return []

      // Exclude Customify-only: must have non-customify work items
      const customerIds = customers.map(c => c.id)
      const { data: withProjects } = await supabase
        .from('work_items')
        .select('customer_id')
        .in('customer_id', customerIds)
        .in('type', ['assisted_project', 'design_service', 'bulk_order'])

      if (!withProjects || withProjects.length === 0) return []
      const hasRealProjectIds = new Set(withProjects.map(w => w.customer_id))
      return customers.filter(c => hasRealProjectIds.has(c.id)).slice(0, 10)
    },
    refetchInterval: 10 * 60 * 1000,
  })
}

// Hook: fetch past event customers whose season is coming up (4 months ahead)
function useSeasonalOutreach() {
  return useQuery({
    queryKey: ['morning-briefing', 'seasonal-outreach'],
    queryFn: async () => {
      const supabase = createClient()
      const now = new Date()
      const targetMonth = ((now.getMonth() + 4) % 12) + 1 // 1-based month, 4 months ahead

      // Find work items with event_date set
      const { data: eventItems, error } = await supabase
        .from('work_items')
        .select('customer_id, customer_name, customer_email, event_date, title')
        .not('event_date', 'is', null)
        .not('customer_id', 'is', null)

      if (error) throw error
      if (!eventItems || eventItems.length === 0) return []

      // Filter to items where event month matches target and event is in the past
      const matching = eventItems.filter(item => {
        const eventDate = new Date(item.event_date!)
        return (eventDate.getMonth() + 1) === targetMonth && eventDate < now
      })

      if (matching.length === 0) return []

      // Group by customer
      const customerMap = new Map<string, { eventDate: string; orderCount: number }>()
      for (const item of matching) {
        const cid = item.customer_id!
        const existing = customerMap.get(cid)
        if (!existing) {
          customerMap.set(cid, { eventDate: item.event_date!, orderCount: 1 })
        } else {
          existing.orderCount++
          if (new Date(item.event_date!) > new Date(existing.eventDate)) {
            existing.eventDate = item.event_date!
          }
        }
      }

      const customerIds = Array.from(customerMap.keys())
      const { data: customers } = await supabase
        .from('customers')
        .select('id, email, first_name, last_name, display_name, organization_name, customer_type')
        .in('id', customerIds)

      if (!customers) return []

      // Exclude Customify-only
      const { data: withProjects } = await supabase
        .from('work_items')
        .select('customer_id')
        .in('customer_id', customerIds)
        .in('type', ['assisted_project', 'design_service', 'bulk_order'])

      const hasRealProjectIds = new Set((withProjects || []).map(w => w.customer_id))

      return customers
        .filter(c => hasRealProjectIds.has(c.id))
        .map(c => ({
          ...c,
          eventDate: customerMap.get(c.id)!.eventDate,
          orderCount: customerMap.get(c.id)!.orderCount,
        }))
        .slice(0, 10)
    },
    refetchInterval: 30 * 60 * 1000,
  })
}

// Hook: fetch dormant customers (no activity in 90+ days)
// Only include: retailers, organizations, customers with assisted_project work items, or sales_stage beyond new_lead
function useDormantCustomers() {
  return useQuery({
    queryKey: ['morning-briefing', 'dormant-customers'],
    queryFn: async () => {
      const supabase = createClient()
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

      // Fetch candidate dormant customers
      const { data: candidates, error } = await supabase
        .from('customers')
        .select('id, email, first_name, last_name, display_name, organization_name, customer_type, sales_stage, updated_at, last_inbound_at, last_outbound_at')
        .lt('updated_at', ninetyDaysAgo)
        .limit(200)

      if (error) throw error
      if (!candidates || candidates.length === 0) return []

      // Filter: only include meaningful customers
      const meaningful = candidates.filter(c => {
        // Include retailers and organizations
        if (c.customer_type === 'retailer' || c.customer_type === 'organization') return true
        // Include customers with sales_stage beyond new_lead
        if (c.sales_stage && c.sales_stage !== 'new_lead') return true
        return false
      })

      // Also check for customers with assisted_project work items
      const remainingIds = candidates
        .filter(c => c.customer_type === 'individual' && (!c.sales_stage || c.sales_stage === 'new_lead'))
        .map(c => c.id)

      if (remainingIds.length > 0) {
        const { data: withProjects } = await supabase
          .from('work_items')
          .select('customer_id')
          .in('customer_id', remainingIds)
          .eq('type', 'assisted_project')

        if (withProjects) {
          const projectCustomerIds = new Set(withProjects.map(w => w.customer_id))
          const additionalCustomers = candidates.filter(c => projectCustomerIds.has(c.id))
          meaningful.push(...additionalCustomers)
        }
      }

      // Deduplicate and sort by staleness
      const seen = new Set<string>()
      return meaningful
        .filter(c => {
          if (seen.has(c.id)) return false
          seen.add(c.id)
          return true
        })
        .sort((a, b) => new Date(a.updated_at!).getTime() - new Date(b.updated_at!).getTime())
        .slice(0, 10)
    },
    refetchInterval: 10 * 60 * 1000,
  })
}

// Hook: lost deal analytics — close reasons from last 90 days
function useLostDealAnalytics() {
  return useQuery({
    queryKey: ['dashboard', 'lost-deals'],
    queryFn: async () => {
      const supabase = createClient()
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

      // Only include real lost deal reasons (exclude won, spam, and system/cleanup reasons)
      const validLostReasons = ['missed_deadline', 'too_expensive', 'ghosted', 'went_with_competitor', 'not_ready_yet', 'cancelled', 'other']
      const { data, error } = await supabase
        .from('work_items')
        .select('close_reason, estimated_value, closed_at')
        .not('closed_at', 'is', null)
        .gte('closed_at', ninetyDaysAgo)
        .in('close_reason', validLostReasons)

      if (error) throw error
      if (!data || data.length === 0) return { reasons: [], totalLost: 0, count: 0 }

      // Group by reason
      const reasonMap = new Map<string, { count: number; value: number }>()
      let totalLost = 0
      for (const item of data) {
        const reason = item.close_reason || 'other'
        const existing = reasonMap.get(reason) || { count: 0, value: 0 }
        existing.count++
        existing.value += item.estimated_value || 0
        totalLost += item.estimated_value || 0
        reasonMap.set(reason, existing)
      }

      const reasons = Array.from(reasonMap.entries())
        .map(([reason, stats]) => ({ reason, ...stats }))
        .sort((a, b) => b.count - a.count)

      return { reasons, totalLost, count: data.length }
    },
    refetchInterval: 30 * 60 * 1000,
  })
}

// Hook: revenue overview from shopify_orders
function useRevenueOverview() {
  return useQuery({
    queryKey: ['dashboard', 'revenue-overview'],
    queryFn: async () => {
      const supabase = createClient()
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      // Get all orders
      const { data: allOrders, error } = await supabase
        .from('shopify_orders')
        .select('total_price, created_at, customer_email, financial_status')

      if (error) throw error
      if (!allOrders || allOrders.length === 0) {
        return { totalRevenue: 0, recentRevenue: 0, orderCount: 0, recentCount: 0, avgOrderValue: 0, uniqueCustomers: 0 }
      }

      const paidOrders = allOrders.filter(o => o.financial_status === 'paid' || o.financial_status === 'partially_paid')
      const recentOrders = paidOrders.filter(o => o.created_at && o.created_at >= thirtyDaysAgo)
      const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.total_price || 0), 0)
      const recentRevenue = recentOrders.reduce((sum, o) => sum + (o.total_price || 0), 0)
      const uniqueEmails = new Set(paidOrders.map(o => o.customer_email?.toLowerCase()).filter(Boolean))

      return {
        totalRevenue,
        recentRevenue,
        orderCount: paidOrders.length,
        recentCount: recentOrders.length,
        avgOrderValue: paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0,
        uniqueCustomers: uniqueEmails.size,
      }
    },
    refetchInterval: 30 * 60 * 1000,
  })
}

function getCustomerDisplayName(c: any): string {
  return c.display_name ||
    (c.organization_name && (c.customer_type === 'retailer' || c.customer_type === 'organization') ? c.organization_name : null) ||
    [c.first_name, c.last_name].filter(Boolean).join(' ') ||
    c.email || 'Unknown'
}

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

export default function DashboardPage() {
  const { data: sales, isLoading: salesLoading } = useOrganizedSalesPipeline()
  const { data: production, isLoading: productionLoading } = useOrganizedProductionPipeline()
  const { data: untriagedResult } = useUntriagedEmails()
  const untriagedEmails = untriagedResult?.items
  const { data: myTasks } = useMyTasks()
  const toggleTask = useToggleTask()

  const { data: needsReply } = useNeedsMyReply()
  const { data: waitingOn } = useWaitingOnCustomer()
  const { data: followUps } = useFollowUpsBriefing()
  const { data: customerCheckIns } = useCustomerCheckIns()
  const { data: dormantCustomers } = useDormantCustomers()
  const { data: retailReorders } = useRetailReorders()
  const { data: seasonalOutreach } = useSeasonalOutreach()
  const { data: lostDeals } = useLostDealAnalytics()
  const { data: revenue } = useRevenueOverview()
  const queryClient = useQueryClient()

  const handleAcknowledge = async (customerId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const supabase = createClient()
    const { error } = await supabase
      .from('customers')
      .update({ last_outbound_at: new Date().toISOString() })
      .eq('id', customerId)
    if (error) {
      toast.error('Failed to acknowledge')
      return
    }
    toast.success('Marked as no reply needed')
    queryClient.invalidateQueries({ queryKey: ['morning-briefing'] })
  }

  // Quick action: snooze a follow-up by 3 days
  const handleSnoozeFollowUp = async (workItemId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const supabase = createClient()
    const newDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    const { error } = await supabase
      .from('work_items')
      .update({ next_follow_up_at: newDate })
      .eq('id', workItemId)
    if (error) {
      toast.error('Failed to snooze')
      return
    }
    toast.success('Snoozed for 3 days')
    queryClient.invalidateQueries({ queryKey: ['morning-briefing'] })
  }

  // Quick action: complete a customer check-in (clear follow-up date)
  const handleCompleteCheckIn = async (customerId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const supabase = createClient()
    const { error } = await supabase
      .from('customers')
      .update({
        next_follow_up_at: null,
        follow_up_reason: null,
        last_outbound_at: new Date().toISOString(),
      })
      .eq('id', customerId)
    if (error) {
      toast.error('Failed to complete check-in')
      return
    }
    toast.success('Check-in completed')
    queryClient.invalidateQueries({ queryKey: ['morning-briefing'] })
  }

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return ''
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (date: string | null) => {
    if (!date) return ''
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  }

  if (salesLoading || productionLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    )
  }

  const hasMorningItems = (needsReply && needsReply.length > 0) ||
    (waitingOn && waitingOn.length > 0) ||
    (followUps && followUps.length > 0) ||
    (customerCheckIns && customerCheckIns.length > 0) ||
    (dormantCustomers && dormantCustomers.length > 0) ||
    (retailReorders && retailReorders.length > 0) ||
    (seasonalOutreach && seasonalOutreach.length > 0)

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Morning Briefing</h1>
        <p className="text-muted-foreground">Who needs attention today</p>
      </div>

      {/* Inbox Alert Strip */}
      {untriagedEmails && untriagedEmails.length > 0 && (
        <Link href="/inbox" className="block">
          <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 hover:bg-blue-100/80 transition-colors cursor-pointer">
            <div className="text-sm font-medium flex items-center gap-2 text-blue-700">
              <Mail className="h-4 w-4" />
              {untriagedEmails.length} New Email{untriagedEmails.length > 1 ? 's' : ''} Need Triage
            </div>
            <span className="text-sm font-medium text-blue-600">View Inbox &rarr;</span>
          </div>
        </Link>
      )}

      {/* ===================== MORNING BRIEFING — 2-col grid ===================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* LEFT COLUMN: Reply-related + Follow-ups */}
        <div className="space-y-4">
          {/* Needs My Reply */}
          {needsReply && needsReply.length > 0 && (
            <Card className="border-l-2 border-l-amber-400">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700">
                  <Inbox className="h-4 w-4" />
                  Needs My Reply ({needsReply.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                {needsReply.map((c) => {
                  const days = daysAgo(c.last_inbound_at!)
                  return (
                    <div key={c.id} className="p-2 rounded-lg hover:bg-muted transition-colors flex items-center justify-between gap-2">
                      <Link href={`/customers/${c.id}?tab=activity`} className="flex-1 min-w-0 cursor-pointer" onClick={() => setQueue({ source: 'Needs My Reply', type: 'customer', ids: needsReply.map(x => x.id) })}>
                        <div className="font-medium text-sm">{getCustomerDisplayName(c)}</div>
                      </Link>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="outline" className="text-amber-600 border-amber-300 text-[11px] gap-0.5 px-1.5 py-0">
                          <Clock className="h-2.5 w-2.5" />
                          {days === 0 ? 'Today' : `${days}d`}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-muted-foreground hover:text-green-600"
                          onClick={(e) => handleAcknowledge(c.id, e)}
                          title="No reply needed"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Waiting on Customer */}
          {waitingOn && waitingOn.length > 0 && (
            <Card className="border-l-2 border-l-slate-300">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                  <Send className="h-4 w-4" />
                  Waiting on Customer ({waitingOn.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                {waitingOn.map((c) => {
                  const days = daysAgo(c.last_outbound_at!)
                  return (
                    <Link key={c.id} href={`/customers/${c.id}?tab=activity`} onClick={() => setQueue({ source: 'Waiting on Customer', type: 'customer', ids: waitingOn!.map(x => x.id) })}>
                      <div className="p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors flex items-center justify-between">
                        <div className="font-medium text-sm truncate">{getCustomerDisplayName(c)}</div>
                        <Badge variant="outline" className="text-muted-foreground border-muted text-[11px] gap-0.5 px-1.5 py-0 ml-2 shrink-0">
                          <Clock className="h-2.5 w-2.5" />
                          {days}d
                        </Badge>
                      </div>
                    </Link>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Follow-Ups Due */}
          {followUps && followUps.length > 0 && (
            <Card className="border-l-2 border-l-red-400">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    Follow-Ups Due ({followUps.length})
                  </CardTitle>
                  <Link href="/follow-ups">
                    <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                      View All <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                {followUps.slice(0, 5).map((item) => {
                  const isOverdue = item.next_follow_up_at && new Date(item.next_follow_up_at) < new Date()
                  return (
                    <Link key={item.id} href={`/work-items/${item.id}`} onClick={() => setQueue({ source: 'Follow-Ups Due', type: 'work-item', ids: followUps!.slice(0, 5).map(x => x.id) })}>
                      <div className="p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm flex items-center gap-1.5">
                            {(() => { const h = scoreLeadHealth(item as any); return <HealthDot level={h.level} reason={h.reason} /> })()}
                            {(item as any).customer?.display_name || item.customer_name || (item as any).customer?.email || item.customer_email}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{item.title}</div>
                        </div>
                        <div className="flex items-center gap-1.5 ml-2 shrink-0">
                          {item.estimated_value && (
                            <Badge variant="outline" className="text-[11px] px-1.5 py-0">
                              {formatCurrency(item.estimated_value)}
                            </Badge>
                          )}
                          <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                            {formatDate(item.next_follow_up_at)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 text-muted-foreground hover:text-blue-600"
                            onClick={(e) => handleSnoozeFollowUp(item.id, e)}
                            title="Snooze 3 days"
                          >
                            <Clock className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </Link>
                  )
                })}
                {followUps.length > 5 && (
                  <Link href="/follow-ups">
                    <div className="text-xs text-center font-medium text-red-600/70 hover:text-red-600 py-1 hover:underline">
                      +{followUps.length - 5} more &rarr;
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN: Check-ins + Dormant + Tasks */}
        <div className="space-y-4">
          {/* Customer Check-ins — now shows follow-up reason context */}
          {customerCheckIns && customerCheckIns.length > 0 && (
            <Card className="border-l-2 border-l-blue-400">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-700">
                  <UserCheck className="h-4 w-4" />
                  Customer Check-ins ({customerCheckIns.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                {customerCheckIns.slice(0, 5).map((c) => {
                  const isOverdue = new Date(c.next_follow_up_at!) < new Date()
                  const reasonLabel = c.follow_up_reason === 'post-delivery' ? 'Post-delivery check-in'
                    : c.follow_up_reason === 'win-back' && c.follow_up_touch_number && c.follow_up_max_touches
                      ? `Win-back (touch ${c.follow_up_touch_number}/${c.follow_up_max_touches})`
                      : c.follow_up_reason === 'seasonal' ? 'Seasonal outreach'
                      : c.follow_up_reason === 'reorder-prompt' ? 'Reorder prompt'
                      : null
                  return (
                    <Link key={c.id} href={`/customers/${c.id}?tab=activity`} onClick={() => setQueue({ source: 'Customer Check-ins', type: 'customer', ids: customerCheckIns!.slice(0, 5).map(x => x.id) })}>
                      <div className="p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate flex items-center gap-1.5">
                            {(() => { const h = scoreCustomerHealth(c as any); return <HealthDot level={h.level} reason={h.reason} /> })()}
                            {getCustomerDisplayName(c)}
                          </div>
                          {reasonLabel && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              {c.follow_up_reason === 'post-delivery' && <PackageCheck className="h-3 w-3" />}
                              {c.follow_up_reason === 'win-back' && <RotateCcw className="h-3 w-3" />}
                              {reasonLabel}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-2 shrink-0">
                          <Badge variant="outline" className={`text-[11px] gap-0.5 px-1.5 py-0 ${isOverdue ? 'text-red-600 border-red-300' : 'text-blue-600 border-blue-300'}`}>
                            <Calendar className="h-2.5 w-2.5" />
                            {isOverdue ? `${daysAgo(c.next_follow_up_at!)}d overdue` : 'Today'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 text-muted-foreground hover:text-green-600"
                            onClick={(e) => handleCompleteCheckIn(c.id, e)}
                            title="Mark check-in done"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </Link>
                  )
                })}
                {customerCheckIns.length > 5 && (
                  <Link href="/customers">
                    <div className="text-xs text-center font-medium text-blue-600/70 hover:text-blue-600 py-1 hover:underline">
                      +{customerCheckIns.length - 5} more &rarr;
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {/* Dormant Customers */}
          {dormantCustomers && dormantCustomers.length > 0 && (
            <Card className="border-l-2 border-l-orange-300">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-orange-600">
                  <AlertTriangle className="h-4 w-4" />
                  Dormant ({dormantCustomers.length})
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">No activity in 90+ days</p>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                {dormantCustomers.slice(0, 5).map((c) => {
                  const lastActivity = c.last_inbound_at || c.last_outbound_at || c.updated_at
                  return (
                    <Link key={c.id} href={`/customers/${c.id}?tab=activity`} onClick={() => setQueue({ source: 'Dormant Customers', type: 'customer', ids: dormantCustomers!.slice(0, 5).map(x => x.id) })}>
                      <div className="p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{getCustomerDisplayName(c)}</div>
                          {c.customer_type !== 'individual' && (
                            <div className="text-xs text-muted-foreground capitalize">{c.customer_type}</div>
                          )}
                        </div>
                        <Badge variant="outline" className="text-orange-600 border-orange-300 text-[11px] gap-0.5 px-1.5 py-0 ml-2 shrink-0">
                          <Clock className="h-2.5 w-2.5" />
                          {lastActivity ? `${daysAgo(lastActivity)}d` : '90d+'}
                        </Badge>
                      </div>
                    </Link>
                  )
                })}
                {dormantCustomers.length > 5 && (
                  <Link href="/customers">
                    <div className="text-xs text-center font-medium text-orange-600/70 hover:text-orange-600 py-1 hover:underline">
                      +{dormantCustomers.length - 5} more &rarr;
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {/* Retail Reorders — retailers/orgs who haven't ordered in 60+ days */}
          {retailReorders && retailReorders.length > 0 && (
            <Card className="border-l-2 border-l-emerald-400">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-700">
                  <RefreshCw className="h-4 w-4" />
                  Retail Reorders ({retailReorders.length})
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Haven&apos;t ordered in 60+ days</p>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                {retailReorders.slice(0, 5).map((c) => (
                  <Link key={c.id} href={`/customers/${c.id}?tab=activity`} onClick={() => setQueue({ source: 'Retail Reorders', type: 'customer', ids: retailReorders!.slice(0, 5).map(x => x.id) })}>
                    <div className="p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{getCustomerDisplayName(c)}</div>
                        <div className="text-xs text-muted-foreground capitalize">{c.customer_type}</div>
                      </div>
                      <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        {c.total_order_count && (
                          <Badge variant="outline" className="text-[11px] px-1.5 py-0">
                            {c.total_order_count} order{c.total_order_count !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-[11px] gap-0.5 px-1.5 py-0">
                          <Clock className="h-2.5 w-2.5" />
                          {c.last_order_date ? `${daysAgo(c.last_order_date)}d` : '60d+'}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
                {retailReorders.length > 5 && (
                  <Link href="/customers">
                    <div className="text-xs text-center font-medium text-emerald-600/70 hover:text-emerald-600 py-1 hover:underline">
                      +{retailReorders.length - 5} more &rarr;
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {/* Seasonal Outreach — past event customers whose season is coming up */}
          {seasonalOutreach && seasonalOutreach.length > 0 && (
            <Card className="border-l-2 border-l-purple-400">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-purple-700">
                  <Sun className="h-4 w-4" />
                  Seasonal Outreach ({seasonalOutreach.length})
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Past event customers &mdash; their season is coming up</p>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                {seasonalOutreach.slice(0, 5).map((c) => (
                  <Link key={c.id} href={`/customers/${c.id}?tab=activity`} onClick={() => setQueue({ source: 'Seasonal Outreach', type: 'customer', ids: seasonalOutreach!.slice(0, 5).map(x => x.id) })}>
                    <div className="p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{getCustomerDisplayName(c)}</div>
                        <div className="text-xs text-muted-foreground">
                          Event {new Date(c.eventDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                          {c.orderCount > 1 && ` (${c.orderCount} orders)`}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-purple-600 border-purple-300 text-[11px] gap-0.5 px-1.5 py-0 ml-2 shrink-0">
                        <Calendar className="h-2.5 w-2.5" />
                        {c.orderCount} order{c.orderCount !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </Link>
                ))}
                {seasonalOutreach.length > 5 && (
                  <Link href="/customers">
                    <div className="text-xs text-center font-medium text-purple-600/70 hover:text-purple-600 py-1 hover:underline">
                      +{seasonalOutreach.length - 5} more &rarr;
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {/* My Tasks */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ListTodo className="h-4 w-4" />
                  My Tasks {myTasks && myTasks.length > 0 ? `(${myTasks.length})` : ''}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-1">
              {!myTasks || myTasks.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No tasks right now
                </div>
              ) : (
                myTasks.map((task) => {
                  const isOverdue = task.due_date && new Date(task.due_date) < new Date()
                  return (
                    <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors">
                      <button
                        type="button"
                        onClick={() => toggleTask.mutate({ taskId: task.id, completed: true })}
                        className="shrink-0 text-muted-foreground hover:text-primary"
                      >
                        <Circle className="h-4 w-4" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{task.title}</div>
                        {task.due_date && (
                          <div className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                            Due {formatDate(task.due_date)}
                          </div>
                        )}
                      </div>
                      {task.work_item_id && (
                        <Link href={`/work-items/${task.work_item_id}`} className="text-xs text-primary hover:underline shrink-0">
                          View
                        </Link>
                      )}
                      {!task.work_item_id && task.customer_id && (
                        <Link href={`/customers/${task.customer_id}`} className="text-xs text-primary hover:underline shrink-0">
                          View
                        </Link>
                      )}
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>

      </div>

      {/* All clear state */}
      {!hasMorningItems && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <div className="font-medium">You're all caught up!</div>
            <div className="text-sm">No replies needed, no follow-ups due today</div>
          </CardContent>
        </Card>
      )}

      {/* Split View: Sales + Production */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SALES PIPELINE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Sales Pipeline
            </h2>
            <Link href="/sales-leads">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>

          {/* Overdue */}
          {sales?.overdue && sales.overdue.length > 0 && (
            <Card className="border-l-2 border-l-red-400">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  Overdue ({sales.overdue.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                {sales.overdue.slice(0, 3).map((lead) => (
                  <Link key={lead.id} href={`/work-items/${lead.id}`}>
                    <div className="p-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{lead.customer_name}</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {lead.title}
                          </div>
                          <div className="flex gap-2 mt-1">
                            {lead.estimated_value && (
                              <Badge variant="outline" className="text-xs">
                                {formatCurrency(lead.estimated_value)}
                              </Badge>
                            )}
                            {lead.tag_names && lead.tag_names.length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {lead.tag_names[0]}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-red-600">
                          {formatDate(lead.next_follow_up_at)}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
                {sales.overdue.length > 3 && (
                  <Link href="/follow-ups">
                    <div className="text-sm text-center font-medium text-red-600/70 hover:text-red-600 py-2 hover:underline">
                      +{sales.overdue.length - 3} more overdue &rarr;
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {/* New Inquiries */}
          {sales?.newInquiries && sales.newInquiries.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  New Inquiries ({sales.newInquiries.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                {sales.newInquiries.slice(0, 3).map((lead) => (
                  <Link key={lead.id} href={`/work-items/${lead.id}`}>
                    <div className="p-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{lead.customer_name}</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {lead.title}
                          </div>
                          <div className="flex gap-2 mt-1">
                            {lead.estimated_value && (
                              <Badge variant="outline" className="text-xs">
                                {formatCurrency(lead.estimated_value)}
                              </Badge>
                            )}
                            {lead.email_count > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                <Mail className="h-3 w-3 mr-1" />
                                {lead.email_count}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(lead.created_at)}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
                {sales.newInquiries.length > 3 && (
                  <Link href="/sales-leads">
                    <div className="text-sm text-center font-medium text-muted-foreground hover:text-foreground py-2 hover:underline">
                      +{sales.newInquiries.length - 3} more inquiries &rarr;
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {/* High Value */}
          {sales?.highValue && sales.highValue.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  High Value ({sales.highValue.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                {sales.highValue.slice(0, 3).map((lead) => (
                  <Link key={lead.id} href={`/work-items/${lead.id}`}>
                    <div className="p-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{lead.customer_name}</div>
                          <div className="text-sm text-muted-foreground capitalize">
                            {lead.status.replace(/_/g, ' ')}
                          </div>
                          <Badge variant="default" className="text-xs mt-1 bg-green-600">
                            {formatCurrency(lead.estimated_value!)}
                          </Badge>
                        </div>
                        {lead.event_date && (
                          <div className="text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3 inline mr-1" />
                            {new Date(lead.event_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
                {sales.highValue.length > 3 && (
                  <Link href="/sales-leads">
                    <div className="text-sm text-center font-medium text-muted-foreground hover:text-foreground py-2 hover:underline">
                      +{sales.highValue.length - 3} more high value &rarr;
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {(!sales?.overdue || sales.overdue.length === 0) &&
           (!sales?.newInquiries || sales.newInquiries.length === 0) &&
           (!sales?.highValue || sales.highValue.length === 0) && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <div>No active sales leads</div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* PRODUCTION PIPELINE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Package className="h-5 w-5" />
              Production Pipeline
            </h2>
            <Link href="/work-items">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>

          {/* Needs Design Review */}
          {production?.needsReview && production.needsReview.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Palette className="h-4 w-4 text-amber-600" />
                  Needs Design Review ({production.needsReview.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                {production.needsReview.slice(0, 5).map((project) => (
                  <Link key={project.id} href={`/work-items/${project.id}`}>
                    <div className="p-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                      <div className="font-medium">{project.customer_name}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {project.title}
                      </div>
                    </div>
                  </Link>
                ))}
                {production.needsReview.length > 5 && (
                  <Link href="/customify-orders">
                    <div className="text-sm text-center font-medium text-muted-foreground hover:text-foreground py-2 hover:underline">
                      +{production.needsReview.length - 5} more to review &rarr;
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {/* Ready for Batch */}
          {production?.readyForBatch && production.readyForBatch.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-600" />
                  Ready for Batch ({production.readyForBatch.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {production.readyForBatch.length} item{production.readyForBatch.length !== 1 ? 's' : ''} awaiting batch
                  </div>
                  <Link href="/batches">
                    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 px-3">
                      Create Batch &rarr;
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* In Progress */}
          {production?.inProgress && production.inProgress.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-purple-600" />
                  In Production ({production.inProgress.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="text-sm text-muted-foreground">
                  {production.inProgress.length} project{production.inProgress.length !== 1 ? 's' : ''} currently being produced
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recently Shipped */}
          {production?.recentlyShipped && production.recentlyShipped.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Truck className="h-4 w-4 text-green-600" />
                  Recently Shipped ({production.recentlyShipped.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                {production.recentlyShipped.slice(0, 3).map((project) => (
                  <Link key={project.id} href={`/work-items/${project.id}`}>
                    <div className="p-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                      <div className="font-medium">{project.customer_name}</div>
                      <div className="text-sm text-green-600">Shipped</div>
                    </div>
                  </Link>
                ))}
                {production.recentlyShipped.length > 3 && (
                  <Link href="/work-items">
                    <div className="text-sm text-center font-medium text-muted-foreground hover:text-foreground py-2 hover:underline">
                      +{production.recentlyShipped.length - 3} more shipped &rarr;
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {(!production?.needsReview || production.needsReview.length === 0) &&
           (!production?.readyForBatch || production.readyForBatch.length === 0) &&
           (!production?.inProgress || production.inProgress.length === 0) && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <div>No active production</div>
                <div className="text-sm">Nothing in the pipeline right now</div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Revenue Overview + Lost Deal Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Overview */}
        {revenue && revenue.orderCount > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                Revenue Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                  <div className="text-xs text-muted-foreground">Total Revenue</div>
                  <div className="text-lg font-bold text-green-700 dark:text-green-400">
                    {formatCurrency(revenue.totalRevenue)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                  <div className="text-xs text-muted-foreground">Last 30 Days</div>
                  <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                    {formatCurrency(revenue.recentRevenue)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="text-xs text-muted-foreground">Avg Order</div>
                  <div className="text-base font-semibold">
                    {formatCurrency(revenue.avgOrderValue)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="text-xs text-muted-foreground">Customers</div>
                  <div className="text-base font-semibold">
                    {revenue.uniqueCustomers}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground text-center">
                {revenue.orderCount} total orders ({revenue.recentCount} in last 30 days)
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lost Deal Analytics */}
        {lostDeals && lostDeals.count > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                Lost Deals (Last 90 Days)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex items-center gap-4 mb-3">
                <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 flex-1">
                  <div className="text-xs text-muted-foreground">Deals Lost</div>
                  <div className="text-lg font-bold text-orange-700 dark:text-orange-400">{lostDeals.count}</div>
                </div>
                {lostDeals.totalLost > 0 && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 flex-1">
                    <div className="text-xs text-muted-foreground">Est. Lost Revenue</div>
                    <div className="text-lg font-bold text-red-700 dark:text-red-400">
                      {formatCurrency(lostDeals.totalLost)}
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                {lostDeals.reasons.map(({ reason, count, value }) => {
                  const label: Record<string, string> = {
                    missed_deadline: 'Missed deadline',
                    too_expensive: 'Too expensive',
                    ghosted: 'Ghosted',
                    went_with_competitor: 'Went with competitor',
                    not_ready_yet: 'Not ready yet',
                    cancelled: 'Event cancelled',
                    other: 'Other',
                  }
                  return (
                    <div key={reason} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label[reason] || reason}</span>
                      <div className="flex items-center gap-2">
                        {value > 0 && <span className="text-xs text-muted-foreground">{formatCurrency(value)}</span>}
                        <Badge variant="outline" className="text-xs px-1.5 py-0">{count}</Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
