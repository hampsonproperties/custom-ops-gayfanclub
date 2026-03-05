'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  User,
  Mail,
  Phone,
  ShoppingBag,
  Plus,
  Search,
  Filter,
  ArrowRight,
  Calendar,
  LayoutGrid,
  List as ListIcon,
  Building2,
  DollarSign,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow, format } from 'date-fns'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { CustomerKanban } from '@/components/customers/customer-kanban'
import { CreateCustomerDialog } from '@/components/customers/create-customer-dialog'
import { PaginationControls } from '@/components/ui/pagination-controls'

interface Customer {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  display_name: string | null
  phone: string | null
  shopify_customer_id: string | null
  created_at: string
  updated_at: string
  // Computed fields
  project_count?: number
  last_contact?: string
  total_spent?: number
}

interface CustomerStats {
  total: number
  with_projects: number
  recent_contacts: number
}

export default function CustomersPage() {
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'with_projects' | 'no_projects'>('all')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  // Reset page when filters change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setPage(1)
  }
  const handleFilterChange = (value: 'all' | 'with_projects' | 'no_projects') => {
    setFilterStatus(value)
    setPage(1)
  }

  // Paginate in list view, but not when "no_projects" filter is active
  // (no_projects requires client-side filtering after join, so server pagination breaks it)
  const isPaginated = view === 'list' && filterStatus !== 'no_projects'

  // Fetch customers with stats
  const { data: customersData, isLoading, refetch } = useQuery({
    queryKey: ['customers', searchQuery, filterStatus, isPaginated ? page : 'all', isPaginated ? PAGE_SIZE : 'all'],
    queryFn: async () => {
      const supabase = createClient()

      // For "with_projects" filter, use inner join to only get customers with work items
      const joinType = filterStatus === 'with_projects' ? '!inner' : ''
      let query = supabase
        .from('customers')
        .select(`
          *,
          work_items${joinType} (
            id,
            status,
            created_at,
            updated_at
          ),
          assigned_to_user:users!assigned_to_user_id (
            id,
            full_name,
            email
          )
        `, isPaginated ? { count: 'exact' } : {})
        .order('updated_at', { ascending: false })

      // Apply search filter
      if (searchQuery) {
        query = query.or(`email.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
      }

      // Apply pagination range
      if (isPaginated) {
        const from = (page - 1) * PAGE_SIZE
        const to = from + PAGE_SIZE - 1
        query = query.range(from, to)
      }

      const { data, error, count } = await query

      if (error) throw error

      // Process data to add computed fields
      const processed = (data || []).map((customer: any) => {
        const projects = customer.work_items || []
        return {
          ...customer,
          project_count: projects.length,
          last_contact: projects[0]?.updated_at || customer.created_at,
          total_spent: customer.total_spent ?? 0,
        }
      })

      // Apply "no_projects" filter client-side (can't be done with Supabase join)
      let filtered = processed
      if (filterStatus === 'no_projects') {
        filtered = processed.filter((c: Customer) => (c.project_count || 0) === 0)
      }

      return { customers: filtered as Customer[], totalCount: count ?? filtered.length }
    },
  })

  const customers = customersData?.customers || []
  const totalCount = customersData?.totalCount ?? 0

  // Separate stats query — counts from full database, not current page
  const { data: stats = { total: 0, with_projects: 0, recent_contacts: 0 } } = useQuery({
    queryKey: ['customers', 'stats'],
    queryFn: async () => {
      const supabase = createClient()

      const [totalResult, withProjectsResult, recentResult] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('customers').select('id, work_items!inner(id)', { count: 'exact', head: true }),
        supabase.from('customers').select('id', { count: 'exact', head: true })
          .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ])

      return {
        total: totalResult.count ?? 0,
        with_projects: withProjectsResult.count ?? 0,
        recent_contacts: recentResult.count ?? 0,
      }
    },
  })

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground mt-1">
            Manage your customer relationships and project history
          </p>
        </div>
        <CreateCustomerDialog
          onCustomerCreated={(customerId) => {
            refetch()
          }}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Customers</CardDescription>
            <CardTitle className="text-2xl sm:text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>With Active Projects</CardDescription>
            <CardTitle className="text-2xl sm:text-3xl">{stats.with_projects}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Contacted This Week</CardDescription>
            <CardTitle className="text-2xl sm:text-3xl">{stats.recent_contacts}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* View Tabs */}
      <Tabs value={view} onValueChange={(v) => setView(v as 'pipeline' | 'list')}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="pipeline" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              Pipeline
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-2">
              <ListIcon className="h-4 w-4" />
              List
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Pipeline View */}
        <TabsContent value="pipeline" className="mt-0 -mx-4 sm:-mx-6 lg:-mx-8">
          <CustomerKanban />
        </TabsContent>

        {/* List View */}
        <TabsContent value="list" className="mt-0">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterStatus} onValueChange={(value: any) => handleFilterChange(value)}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    <SelectItem value="with_projects">With Projects</SelectItem>
                    <SelectItem value="no_projects">No Projects</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading customers...
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12">
              <User className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No customers found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View - Hidden on mobile */}
              <div className="hidden md:block rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="text-center">Projects</TableHead>
                      <TableHead>Est. Value</TableHead>
                      <TableHead>Next Follow-Up</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer.id} className="cursor-pointer hover:bg-muted/50">
                        {/* Customer Name */}
                        <TableCell>
                          <Link href={`/customers/${customer.id}`} className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                              {(customer.display_name || customer.email || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium">
                                {customer.display_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'No name'}
                              </div>
                            </div>
                          </Link>
                        </TableCell>

                        {/* Assigned To */}
                        <TableCell>
                          {(customer as any).assigned_to_user?.full_name ? (
                            <div className="flex items-center gap-2 text-sm">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{(customer as any).assigned_to_user.full_name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>

                        {/* Company */}
                        <TableCell>
                          {(customer as any).organization_name ? (
                            <div className="flex items-center gap-2 text-sm">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{(customer as any).organization_name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* Email */}
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate max-w-[200px]">{customer.email}</span>
                          </div>
                        </TableCell>

                        {/* Phone */}
                        <TableCell>
                          {customer.phone ? (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{customer.phone}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* Projects Count */}
                        <TableCell className="text-center">
                          <Badge variant={customer.project_count ? 'default' : 'secondary'}>
                            {customer.project_count || 0}
                          </Badge>
                        </TableCell>

                        {/* Estimated Value */}
                        <TableCell>
                          {(customer as any).estimated_value ? (
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>${((customer as any).estimated_value).toLocaleString()}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* Next Follow-Up */}
                        <TableCell>
                          {(customer as any).next_follow_up_at ? (
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{format(new Date((customer as any).next_follow_up_at), 'MMM d, yyyy')}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not set</span>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell>
                          <Link href={`/customers/${customer.id}`}>
                            <Button variant="ghost" size="sm">
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View - Shown on mobile only */}
              <div className="md:hidden space-y-3">
                {customers.map((customer) => (
                  <Link key={customer.id} href={`/customers/${customer.id}`}>
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-semibold shrink-0">
                            {(customer.display_name || customer.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Name */}
                            <div className="font-medium text-base mb-1">
                              {customer.display_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'No name'}
                            </div>

                            {/* Company */}
                            {(customer as any).organization_name && (
                              <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5" />
                                <span className="truncate">{(customer as any).organization_name}</span>
                              </div>
                            )}

                            {/* Email */}
                            <div className="text-sm text-muted-foreground mb-1 truncate">
                              {customer.email}
                            </div>

                            {/* Phone */}
                            {customer.phone && (
                              <div className="text-sm text-muted-foreground mb-2">
                                {customer.phone}
                              </div>
                            )}

                            {/* Badges Row */}
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <Badge variant={customer.project_count ? 'default' : 'secondary'} className="text-xs">
                                {customer.project_count || 0} projects
                              </Badge>
                              {(customer as any).estimated_value && (
                                <Badge variant="outline" className="text-xs">
                                  <DollarSign className="h-3 w-3 mr-1" />
                                  ${((customer as any).estimated_value).toLocaleString()}
                                </Badge>
                              )}
                            </div>

                            {/* Assigned To */}
                            {(customer as any).assigned_to_user?.full_name && (
                              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                                <User className="h-3 w-3" />
                                <span>Assigned to {(customer as any).assigned_to_user.full_name}</span>
                              </div>
                            )}

                            {/* Next Follow-Up */}
                            {(customer as any).next_follow_up_at && (
                              <div className="text-xs text-muted-foreground">
                                <span className="font-medium">Follow-up:</span> {format(new Date((customer as any).next_follow_up_at), 'MMM d, yyyy')}
                              </div>
                            )}
                          </div>
                          <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </>
          )}
          <PaginationControls
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={totalCount}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
