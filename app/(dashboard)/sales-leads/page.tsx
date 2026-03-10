'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { Plus, Search, TrendingUp, DollarSign, Target, Award, Mail, ExternalLink, Download, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useLeads, useLeadStats, type LeadsFilters } from '@/lib/hooks/use-leads'
import { StatusBadge } from '@/components/custom/status-badge'
import { formatDistanceToNow } from 'date-fns'
import { setQueue } from '@/lib/hooks/use-queue-navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { generateCSV, downloadCSV, exportFilename, type CSVColumn } from '@/lib/utils/csv-export'
import { getStatusLabel } from '@/lib/utils/status-transitions'
import { scoreLeadHealth } from '@/lib/utils/health-scoring'
import { HealthDot } from '@/components/custom/health-badge'
import type { WorkItemStatus } from '@/types/database'

export default function SalesLeadsPage() {
  const [filters, setFilters] = useState<LeadsFilters>({
    assignedTo: 'all',
    status: 'all',
    search: '',
  })
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  const { data: result, isLoading } = useLeads({ ...filters, page, pageSize: PAGE_SIZE })
  const leads = result?.items
  const totalCount = result?.totalCount ?? 0
  const { data: stats } = useLeadStats()
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      let query = supabase
        .from('work_items')
        .select('*')
        .eq('type', 'assisted_project')
        .in('status', [
          'new_inquiry', 'info_sent', 'future_event_monitoring',
          'design_fee_sent', 'design_fee_paid',
          'closed_won', 'closed_lost', 'closed_event_cancelled',
        ])
        .order('created_at', { ascending: false })

      if (filters.assignedTo === 'me' && user) {
        query = query.eq('assigned_to_user_id', user.id)
      } else if (filters.assignedTo === 'unassigned') {
        query = query.is('assigned_to_user_id', null)
      } else if (filters.assignedTo && filters.assignedTo !== 'all') {
        query = query.eq('assigned_to_user_id', filters.assignedTo)
      }

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }

      if (filters.search) {
        query = query.or(
          `customer_name.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%`
        )
      }

      const { data, error } = await query
      if (error) throw error

      const columns: CSVColumn<any>[] = [
        { header: 'Name', value: (r) => r.customer_name },
        { header: 'Email', value: (r) => r.customer_email },
        { header: 'Company', value: (r) => r.company_name },
        { header: 'Phone', value: (r) => r.phone_number },
        { header: 'Status', value: (r) => getStatusLabel(r.status as WorkItemStatus) },
        { header: 'Est. Value', value: (r) => r.estimated_value },
        { header: 'Event Date', value: (r) => r.event_date ? new Date(r.event_date).toLocaleDateString() : '' },
        { header: 'Lead Source', value: (r) => r.lead_source },
        { header: 'Created', value: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString() : '' },
      ]

      const csv = generateCSV(data || [], columns)
      downloadCSV(csv, exportFilename('sales-leads'))
      toast.success(`Exported ${data?.length || 0} leads`)
    } catch (err) {
      toast.error('Failed to export leads')
    } finally {
      setIsExporting(false)
    }
  }

  const handleFilterChange = (key: keyof LeadsFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  // Helper function to get initials
  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      const parts = name.split(' ')
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      }
      return name.substring(0, 2).toUpperCase()
    }
    if (email) {
      return email.substring(0, 2).toUpperCase()
    }
    return '??'
  }

  // Filter active leads from current page
  const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000
  const activeLeads = (leads ?? []).filter((lead) => {
    if (['closed_won', 'closed_lost', 'closed_event_cancelled'].includes(lead.status)) return false
    if (filters.status === 'stale') {
      const lastActivity = new Date(lead.updated_at || lead.created_at).getTime()
      return lastActivity < fourteenDaysAgo
    }
    return true
  })

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Sales Leads</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage your sales pipeline and convert inquiries into customers
          </p>
        </div>
        <Link href="/inbox">
          <Button size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            Create Lead
          </Button>
        </Link>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <Card className="border-muted/40">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">Active Leads</p>
                <Target className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <div className="text-3xl font-bold">{stats.totalLeads}</div>
            </CardContent>
          </Card>

          <Card className="border-muted/40">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">Pipeline Value</p>
                <DollarSign className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <div className="text-3xl font-bold">
                ${stats.totalValue.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="border-muted/40">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <TrendingUp className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <div className="text-3xl font-bold">{stats.conversionRate}%</div>
            </CardContent>
          </Card>

          <Card className="border-muted/40">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <Award className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <div className="text-3xl font-bold">
                ${stats.totalRevenue.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="border-muted/40">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or company..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <Select
                value={filters.assignedTo || 'all'}
                onValueChange={(value) => handleFilterChange('assignedTo', value)}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Assignment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Leads</SelectItem>
                  <SelectItem value="me">My Leads</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.status || 'all'}
                onValueChange={(value) => handleFilterChange('status', value)}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new_inquiry">New Inquiry</SelectItem>
                  <SelectItem value="info_sent">Info Sent</SelectItem>
                  <SelectItem value="design_fee_sent">Design Fee Sent</SelectItem>
                  <SelectItem value="design_fee_paid">Design Fee Paid</SelectItem>
                  <SelectItem value="closed_won">Won</SelectItem>
                  <SelectItem value="closed_lost">Lost</SelectItem>
                  <SelectItem value="stale">Stale (14d+ no activity)</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting} className="h-9 gap-2">
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table View */}
      <Card className="border-muted/40">
          <CardContent className="p-0">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="bg-muted/5">
                    <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Company</th>
                    <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground whitespace-nowrap">Event Date</th>
                    <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground whitespace-nowrap">Days</th>
                    <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground whitespace-nowrap">Est. Value</th>
                    <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground whitespace-nowrap">Next Follow-Up</th>
                    <th className="text-right px-4 py-3 font-medium text-xs text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        Loading leads...
                      </td>
                    </tr>
                  ) : activeLeads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        No active leads found
                      </td>
                    </tr>
                  ) : (
                    activeLeads.map((lead) => {
                      const extendedLead = lead as any
                      return (
                        <tr key={lead.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <Link href={`/work-items/${lead.id}`} onClick={() => setQueue({ source: 'Sales Leads', type: 'work-item', ids: activeLeads.map(x => x.id) })}>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarFallback className="text-xs bg-muted">
                                    {getInitials(lead.customer_name, lead.customer_email)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm hover:underline flex items-center gap-1.5">
                                    {(() => { const h = scoreLeadHealth(lead as any); return <HealthDot level={h.level} reason={h.reason} /> })()}
                                    {lead.customer_name || lead.customer_email || 'Unknown'}
                                  </p>
                                  <div className="mt-1">
                                    <StatusBadge status={lead.status} />
                                  </div>
                                </div>
                              </div>
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm">
                              {lead.company_name || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm">
                              {lead.customer_email || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              {(lead as any).event_date
                                ? new Date((lead as any).event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                : '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              const days = Math.floor((Date.now() - new Date(lead.updated_at || lead.created_at).getTime()) / (1000 * 60 * 60 * 24))
                              return (
                                <span className={`text-sm ${days >= 14 ? 'text-red-600 font-medium' : days >= 7 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                  {days}d
                                </span>
                              )
                            })()}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm">
                              {extendedLead.estimated_value
                                ? `$${extendedLead.estimated_value.toLocaleString()}`
                                : '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              {extendedLead.next_follow_up_at
                                ? formatDistanceToNow(new Date(extendedLead.next_follow_up_at), { addSuffix: true })
                                : '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                asChild
                              >
                                <Link href={`/work-items/${lead.id}`}>
                                  <Mail className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                asChild
                              >
                                <Link href={`/work-items/${lead.id}`}>
                                  <ExternalLink className="h-4 w-4" />
                                </Link>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden p-3 space-y-3">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading leads...
                </div>
              ) : activeLeads.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No active leads found
                </div>
              ) : (
                activeLeads.map((lead) => {
                  const extendedLead = lead as any
                  return (
                    <Link key={lead.id} href={`/work-items/${lead.id}`} onClick={() => setQueue({ source: 'Sales Leads', type: 'work-item', ids: activeLeads.map(x => x.id) })}>
                      <Card className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Avatar className="h-12 w-12 shrink-0">
                              <AvatarFallback className="text-sm bg-gradient-to-br from-pink-500 to-purple-600 text-white">
                                {getInitials(lead.customer_name, lead.customer_email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-base mb-1 flex items-center gap-1.5">
                                {(() => { const h = scoreLeadHealth(lead as any); return <HealthDot level={h.level} reason={h.reason} /> })()}
                                {lead.customer_name || lead.customer_email || 'Unknown'}
                              </div>
                              <div className="mb-2">
                                <StatusBadge status={lead.status} />
                              </div>
                              <div className="space-y-1.5 text-sm text-muted-foreground">
                                {lead.company_name && (
                                  <div className="truncate">{lead.company_name}</div>
                                )}
                                {lead.customer_email && (
                                  <div className="truncate">{lead.customer_email}</div>
                                )}
                                {extendedLead.estimated_value && (
                                  <div className="font-medium text-foreground">
                                    ${extendedLead.estimated_value.toLocaleString()}
                                  </div>
                                )}
                                {extendedLead.next_follow_up_at && (
                                  <div className="text-xs">
                                    Follow up {formatDistanceToNow(new Date(extendedLead.next_follow_up_at), { addSuffix: true })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })
              )}
            </div>

            <PaginationControls
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={totalCount}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>
    </div>
  )
}
