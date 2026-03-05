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
import { Plus, Search, TrendingUp, DollarSign, Target, Award, Mail, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useLeads, useLeadStats, type LeadsFilters } from '@/lib/hooks/use-leads'
import { StatusBadge } from '@/components/custom/status-badge'
import { formatDistanceToNow } from 'date-fns'

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
  const activeLeads = (leads ?? []).filter(
    (lead) => !['closed_won', 'closed_lost', 'closed_event_cancelled'].includes(lead.status)
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales Leads</h1>
          <p className="text-muted-foreground">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
            <div className="flex gap-2">
              <Select
                value={filters.assignedTo || 'all'}
                onValueChange={(value) => handleFilterChange('assignedTo', value)}
              >
                <SelectTrigger className="w-[180px]">
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
                <SelectTrigger className="w-[180px]">
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
                </SelectContent>
              </Select>

            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table View */}
      <Card className="border-muted/40">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="bg-muted/5">
                    <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Company</th>
                    <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Phone</th>
                    <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground whitespace-nowrap">Est. Value</th>
                    <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground whitespace-nowrap">Next Follow-Up</th>
                    <th className="text-right px-4 py-3 font-medium text-xs text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        Loading leads...
                      </td>
                    </tr>
                  ) : activeLeads.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No active leads found
                      </td>
                    </tr>
                  ) : (
                    activeLeads.map((lead) => {
                      const extendedLead = lead as any
                      return (
                        <tr key={lead.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <Link href={`/work-items/${lead.id}`}>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarFallback className="text-xs bg-muted">
                                    {getInitials(lead.customer_name, lead.customer_email)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm hover:underline">
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
                            <span className="text-sm">
                              {lead.phone_number || '-'}
                            </span>
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
