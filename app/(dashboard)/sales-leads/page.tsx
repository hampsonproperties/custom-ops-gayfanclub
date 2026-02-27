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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Leads
              </CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLeads}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pipeline Value
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats.totalValue.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Conversion Rate
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.conversionRate}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats.totalRevenue.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
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
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/20">
                  <tr>
                    <th className="text-left p-3 font-medium text-sm">Name</th>
                    <th className="text-left p-3 font-medium text-sm">Company</th>
                    <th className="text-left p-3 font-medium text-sm">Email</th>
                    <th className="text-left p-3 font-medium text-sm">Phone</th>
                    <th className="text-left p-3 font-medium text-sm">Est. Value</th>
                    <th className="text-left p-3 font-medium text-sm">Next Follow-Up</th>
                    <th className="text-right p-3 font-medium text-sm">Actions</th>
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
                          <td className="p-3">
                            <Link href={`/sales-leads/${lead.id}`}>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarFallback className="text-xs bg-primary/10">
                                    {getInitials(lead.customer_name, lead.customer_email)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm hover:underline">
                                    {lead.customer_name || lead.customer_email || 'Unknown'}
                                  </p>
                                  <div className="mt-0.5">
                                    <StatusBadge status={lead.status} />
                                  </div>
                                </div>
                              </div>
                            </Link>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              {lead.company_name ? (
                                <>
                                  <Building2 className="h-3.5 w-3.5" />
                                  {lead.company_name}
                                </>
                              ) : (
                                <span className="text-muted-foreground/50">-</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="text-sm text-muted-foreground">
                              {lead.customer_email || '-'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="text-sm text-muted-foreground">
                              {lead.phone_number || '-'}
                            </span>
                          </td>
                          <td className="p-3">
                            {extendedLead.estimated_value ? (
                              <div className="flex items-center gap-1.5 text-sm font-medium">
                                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                                {extendedLead.estimated_value.toLocaleString()}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground/50">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="text-sm text-muted-foreground">
                              {extendedLead.next_follow_up_at
                                ? formatDistanceToNow(new Date(extendedLead.next_follow_up_at), { addSuffix: true })
                                : '-'}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                asChild
                              >
                                <a href={`mailto:${lead.customer_email}`}>
                                  <Mail className="h-4 w-4" />
                                </a>
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
