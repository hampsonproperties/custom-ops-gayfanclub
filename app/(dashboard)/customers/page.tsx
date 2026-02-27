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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newCustomer, setNewCustomer] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
  })

  // Fetch customers with stats
  const { data: customersData, isLoading, refetch } = useQuery({
    queryKey: ['customers', searchQuery, filterStatus],
    queryFn: async () => {
      const supabase = createClient()

      // Build base query
      let query = supabase
        .from('customers')
        .select(`
          *,
          work_items (
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
        `)
        .order('updated_at', { ascending: false })

      // Apply search filter
      if (searchQuery) {
        query = query.or(`email.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
      }

      const { data, error } = await query

      if (error) throw error

      // Process data to add computed fields
      const processed = (data || []).map((customer: any) => {
        const projects = customer.work_items || []
        return {
          ...customer,
          project_count: projects.length,
          last_contact: projects[0]?.updated_at || customer.created_at,
          total_spent: 0, // TODO: Calculate from Shopify orders
        }
      })

      // Apply filter
      let filtered = processed
      if (filterStatus === 'with_projects') {
        filtered = processed.filter((c: Customer) => (c.project_count || 0) > 0)
      } else if (filterStatus === 'no_projects') {
        filtered = processed.filter((c: Customer) => (c.project_count || 0) === 0)
      }

      // Calculate stats
      const stats: CustomerStats = {
        total: processed.length,
        with_projects: processed.filter((c: Customer) => (c.project_count || 0) > 0).length,
        recent_contacts: processed.filter((c: Customer) => {
          const daysSince = (Date.now() - new Date(c.last_contact || c.created_at).getTime()) / (1000 * 60 * 60 * 24)
          return daysSince <= 7
        }).length,
      }

      return { customers: filtered as Customer[], stats }
    },
  })

  const handleCreateCustomer = async () => {
    try {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('customers')
        .insert({
          email: newCustomer.email,
          first_name: newCustomer.first_name || null,
          last_name: newCustomer.last_name || null,
          display_name: `${newCustomer.first_name} ${newCustomer.last_name}`.trim() || newCustomer.email,
          phone: newCustomer.phone || null,
        })
        .select()
        .single()

      if (error) throw error

      toast.success('Customer created successfully!')
      setIsCreateDialogOpen(false)
      setNewCustomer({ email: '', first_name: '', last_name: '', phone: '' })
      refetch()
    } catch (error: any) {
      toast.error(`Failed to create customer: ${error.message}`)
    }
  }

  const customers = customersData?.customers || []
  const stats = customersData?.stats || { total: 0, with_projects: 0, recent_contacts: 0 }

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
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex-shrink-0">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">New Customer</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Customer</DialogTitle>
              <DialogDescription>
                Add a new customer to your CRM
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="customer@example.com"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    placeholder="John"
                    value={newCustomer.first_name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    placeholder="Doe"
                    value={newCustomer.last_name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="555-123-4567"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateCustomer} disabled={!newCustomer.email}>
                Create Customer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
        <TabsContent value="pipeline" className="mt-0">
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
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
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
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
