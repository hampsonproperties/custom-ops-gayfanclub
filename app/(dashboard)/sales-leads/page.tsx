'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Search, TrendingUp, DollarSign, Target, Award } from 'lucide-react'
import Link from 'next/link'
import { LeadCard } from '@/components/leads/lead-card'
import { useLeads, useLeadStats, type LeadsFilters } from '@/lib/hooks/use-leads'

export default function SalesLeadsPage() {
  const [filters, setFilters] = useState<LeadsFilters>({
    assignedTo: 'all',
    status: 'all',
    search: '',
  })

  const { data: leads, isLoading } = useLeads(filters)
  const { data: stats } = useLeadStats()

  const handleFilterChange = (key: keyof LeadsFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different views */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Leads</TabsTrigger>
          <TabsTrigger value="won">Won</TabsTrigger>
          <TabsTrigger value="lost">Lost/Cancelled</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading leads...
            </div>
          ) : !leads || leads.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No leads found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Get started by creating your first lead
                </p>
                <Link href="/leads/new">
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Lead
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {leads
                .filter(
                  (lead) =>
                    !['closed_won', 'closed_lost', 'closed_event_cancelled'].includes(
                      lead.status
                    )
                )
                .map((lead) => (
                  <LeadCard key={lead.id} lead={lead} />
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="won" className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading leads...
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {leads
                ?.filter((lead) => lead.status === 'closed_won')
                .map((lead) => <LeadCard key={lead.id} lead={lead} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="lost" className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading leads...
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {leads
                ?.filter((lead) =>
                  ['closed_lost', 'closed_event_cancelled'].includes(lead.status)
                )
                .map((lead) => <LeadCard key={lead.id} lead={lead} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
