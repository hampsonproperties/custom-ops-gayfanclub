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
import { Plus, Search, TrendingUp, DollarSign, Target, Award, LayoutList, LayoutGrid, Mail, MoreHorizontal, Building2 } from 'lucide-react'
import Link from 'next/link'
import { useLeads, useLeadStats, type LeadsFilters } from '@/lib/hooks/use-leads'
import { StatusBadge } from '@/components/custom/status-badge'
import { formatDistanceToNow } from 'date-fns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function SalesLeadsPage() {
  const [filters, setFilters] = useState<LeadsFilters>({
    assignedTo: 'all',
    status: 'all',
    search: '',
  })
  const [viewMode, setViewMode] = useState<'table' | 'pipeline'>('table')

  const { data: leads, isLoading } = useLeads(filters)
  const { data: stats } = useLeadStats()

  const handleFilterChange = (key: keyof LeadsFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
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

  // Filter active leads
  const activeLeads = leads?.filter(
    (lead) => !['closed_won', 'closed_lost', 'closed_event_cancelled'].includes(lead.status)
  ) || []

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
        <Link href="/leads/new">
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

              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="rounded-r-none"
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'pipeline' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('pipeline')}
                  className="rounded-l-none"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table View */}
      {viewMode === 'table' && (
        <Card className="border-muted/40">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-muted/30">
                  <tr className="bg-muted/5">
                    <th className="text-left px-6 py-4 font-medium text-sm text-muted-foreground">Name</th>
                    <th className="text-left px-6 py-4 font-medium text-sm text-muted-foreground">Company</th>
                    <th className="text-left px-6 py-4 font-medium text-sm text-muted-foreground">Email</th>
                    <th className="text-left px-6 py-4 font-medium text-sm text-muted-foreground">Phone</th>
                    <th className="text-left px-6 py-4 font-medium text-sm text-muted-foreground">Est. Value</th>
                    <th className="text-left px-6 py-4 font-medium text-sm text-muted-foreground">Next Follow-Up</th>
                    <th className="text-right px-6 py-4 font-medium text-sm text-muted-foreground">Actions</th>
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
                        <tr key={lead.id} className="border-b border-muted/30 hover:bg-muted/5 transition-colors">
                          <td className="px-6 py-4">
                            <Link href={`/sales-leads/${lead.id}`}>
                              <div className="flex items-center gap-4">
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback className="text-sm font-medium bg-muted">
                                    {getInitials(lead.customer_name, lead.customer_email)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm hover:underline mb-1.5">
                                    {lead.customer_name || lead.customer_email || 'Unknown'}
                                  </p>
                                  <StatusBadge status={lead.status} />
                                </div>
                              </div>
                            </Link>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-foreground">
                              {lead.company_name || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-foreground">
                              {lead.customer_email || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-foreground">
                              {lead.phone_number || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-foreground">
                              {extendedLead.estimated_value
                                ? `$${extendedLead.estimated_value.toLocaleString()}`
                                : '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-muted-foreground">
                              {extendedLead.next_follow_up_at
                                ? formatDistanceToNow(new Date(extendedLead.next_follow_up_at), { addSuffix: true })
                                : '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0 hover:bg-muted"
                                asChild
                              >
                                <a href={`mailto:${lead.customer_email}`}>
                                  <Mail className="h-4 w-4" />
                                </a>
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0 hover:bg-muted">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem asChild>
                                    <Link href={`/sales-leads/${lead.id}`}>View Details</Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>Change Status</DropdownMenuItem>
                                  <DropdownMenuItem>Send Email</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pipeline View - Placeholder */}
      {viewMode === 'pipeline' && (
        <Card>
          <CardContent className="p-12 text-center">
            <LayoutGrid className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">Pipeline View Coming Soon</h3>
            <p className="text-sm text-muted-foreground">
              Kanban board view will be implemented next
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
