'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { useWorkItems, useUpdateWorkItemStatus } from '@/lib/hooks/use-work-items'
import { StatusBadge } from '@/components/custom/status-badge'
import { KanbanBoard } from '@/components/work-items/kanban-board'
import { Search, Filter, LayoutList, LayoutGrid, Mail, Phone, MoreHorizontal, Building2, DollarSign, ArrowUpDown, ArrowUp, ArrowDown, User, Users } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

export default function WorkItemsPage() {
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'pipeline'>('table')
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [filterMode, setFilterMode] = useState<'my-leads' | 'all-leads'>('my-leads')

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  const { data: workItems, isLoading } = useWorkItems({
    search: debouncedSearch,
    assignedTo: filterMode === 'my-leads' ? 'me' : undefined
  })
  const updateStatusMutation = useUpdateWorkItemStatus()

  // Handler for inline status editing
  const handleStatusChange = async (itemId: string, newStatus: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      await updateStatusMutation.mutateAsync({
        id: itemId,
        status: newStatus,
      })
      toast.success('Status updated successfully')
    } catch (error) {
      toast.error('Failed to update status')
      console.error('Status update error:', error)
    }
  }

  // Handler for column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, default to ascending
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Sort work items based on current sort state
  const sortedWorkItems = workItems ? [...workItems].sort((a, b) => {
    if (!sortColumn) return 0

    const aExtended = a as any
    const bExtended = b as any

    let aValue: any
    let bValue: any

    switch (sortColumn) {
      case 'name':
        aValue = (a.customer_name || a.customer_email || '').toLowerCase()
        bValue = (b.customer_name || b.customer_email || '').toLowerCase()
        break
      case 'assigned':
        aValue = ((aExtended.assigned_to as any)?.full_name || 'Unassigned').toLowerCase()
        bValue = ((bExtended.assigned_to as any)?.full_name || 'Unassigned').toLowerCase()
        break
      case 'company':
        aValue = (aExtended.company_name || '').toLowerCase()
        bValue = (bExtended.company_name || '').toLowerCase()
        break
      case 'email':
        aValue = (a.customer_email || '').toLowerCase()
        bValue = (b.customer_email || '').toLowerCase()
        break
      case 'phone':
        aValue = (aExtended.phone_number || '').toLowerCase()
        bValue = (bExtended.phone_number || '').toLowerCase()
        break
      case 'value':
        aValue = aExtended.estimated_value || 0
        bValue = bExtended.estimated_value || 0
        break
      case 'followup':
        aValue = a.next_follow_up_at ? new Date(a.next_follow_up_at).getTime() : 0
        bValue = b.next_follow_up_at ? new Date(b.next_follow_up_at).getTime() : 0
        break
      default:
        return 0
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
    return 0
  }) : []

  // Helper to render sort icon
  const renderSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5" />
      : <ArrowDown className="h-3.5 w-3.5" />
  }

  // Handlers for bulk selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(sortedWorkItems.map(item => item.id))
      setSelectedItems(allIds)
    } else {
      setSelectedItems(new Set())
    }
  }

  const handleSelectItem = (itemId: string, checked: boolean) => {
    const newSelected = new Set(selectedItems)
    if (checked) {
      newSelected.add(itemId)
    } else {
      newSelected.delete(itemId)
    }
    setSelectedItems(newSelected)
  }

  const allSelected = sortedWorkItems.length > 0 && selectedItems.size === sortedWorkItems.length
  const someSelected = selectedItems.size > 0 && selectedItems.size < sortedWorkItems.length

  // Calculate stats
  const activeLeads = workItems?.filter(item => !item.closed_at).length || 0
  const totalValue = workItems?.reduce((sum, item) => {
    const value = (item as any).estimated_value || 0
    return sum + value
  }, 0) || 0

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

  if (isLoading) {
    return (
      <div className="p-6">
        <p>Loading work items...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales Leads</h1>
          <p className="text-muted-foreground">
            Manage your customer projects and opportunities
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{activeLeads}</div>
            <p className="text-xs text-muted-foreground">Active Leads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">${totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Pipeline Value</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Conversion Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            {/* Filter Toggle - My Leads / All Leads */}
            <div className="flex gap-2">
              <Button
                variant={filterMode === 'my-leads' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('my-leads')}
                className="gap-2 h-9"
              >
                <User className="h-4 w-4" />
                My Leads
              </Button>
              <Button
                variant={filterMode === 'all-leads' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('all-leads')}
                className="gap-2 h-9"
              >
                <Users className="h-4 w-4" />
                All Leads
              </Button>
            </div>

            {/* Search and View Toggle */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, company..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9 h-11 sm:h-9"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2 flex-1 sm:flex-none h-11 sm:h-9">
                  <Filter className="h-4 w-4" />
                  <span className="sm:inline">Filters</span>
                </Button>
                <div className="hidden sm:flex border rounded-md">
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
          </div>
        </CardContent>
      </Card>

      {/* Table View */}
      {viewMode === 'table' && (
        <Card>
          {/* Bulk Action Bar */}
          {selectedItems.size > 0 && (
            <div className="border-b bg-muted/30 p-3 flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-between gap-3">
              <div className="flex items-center justify-between sm:justify-start gap-2">
                <span className="text-sm font-medium">
                  {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedItems(new Set())}
                  className="h-9"
                >
                  Clear
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Button variant="outline" size="sm" className="h-11 sm:h-9">
                  Bulk Update Status
                </Button>
                <Button variant="outline" size="sm" className="h-11 sm:h-9">
                  Export Selected
                </Button>
              </div>
            </div>
          )}
          <CardContent className="p-0">
            {/* Desktop Table View - Hidden on mobile */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/20">
                  <tr>
                    <th className="w-12 p-3">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                        className={someSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                      />
                    </th>
                    <th className="text-left p-3 font-medium text-sm">
                      <button
                        onClick={() => handleSort('name')}
                        className="flex items-center gap-2 hover:text-foreground transition-colors"
                      >
                        Name
                        {renderSortIcon('name')}
                      </button>
                    </th>
                    <th className="text-left p-3 font-medium text-sm">
                      <button
                        onClick={() => handleSort('assigned')}
                        className="flex items-center gap-2 hover:text-foreground transition-colors"
                      >
                        Assigned To
                        {renderSortIcon('assigned')}
                      </button>
                    </th>
                    <th className="text-left p-3 font-medium text-sm">
                      <button
                        onClick={() => handleSort('company')}
                        className="flex items-center gap-2 hover:text-foreground transition-colors"
                      >
                        Company
                        {renderSortIcon('company')}
                      </button>
                    </th>
                    <th className="text-left p-3 font-medium text-sm">
                      <button
                        onClick={() => handleSort('email')}
                        className="flex items-center gap-2 hover:text-foreground transition-colors"
                      >
                        Email
                        {renderSortIcon('email')}
                      </button>
                    </th>
                    <th className="text-left p-3 font-medium text-sm">
                      <button
                        onClick={() => handleSort('phone')}
                        className="flex items-center gap-2 hover:text-foreground transition-colors"
                      >
                        Phone
                        {renderSortIcon('phone')}
                      </button>
                    </th>
                    <th className="text-left p-3 font-medium text-sm">
                      <button
                        onClick={() => handleSort('value')}
                        className="flex items-center gap-2 hover:text-foreground transition-colors"
                      >
                        Est. Value
                        {renderSortIcon('value')}
                      </button>
                    </th>
                    <th className="text-left p-3 font-medium text-sm">
                      <button
                        onClick={() => handleSort('followup')}
                        className="flex items-center gap-2 hover:text-foreground transition-colors"
                      >
                        Next Follow-Up
                        {renderSortIcon('followup')}
                      </button>
                    </th>
                    <th className="text-right p-3 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedWorkItems && sortedWorkItems.length > 0 ? (
                    sortedWorkItems.map((item) => {
                      const extendedItem = item as any
                      return (
                        <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="w-12 p-3">
                            <Checkbox
                              checked={selectedItems.has(item.id)}
                              onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)}
                              aria-label={`Select ${item.customer_name || item.customer_email}`}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="p-3">
                            <Link href={`/work-items/${item.id}`}>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarFallback className="text-xs bg-primary/10">
                                    {getInitials(item.customer_name, item.customer_email)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm hover:underline">
                                    {item.customer_name || item.customer_email || 'Unknown'}
                                  </p>
                                  <div className="mt-0.5" onClick={(e) => e.preventDefault()}>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button className="cursor-pointer hover:opacity-80 transition-opacity">
                                          <StatusBadge status={item.status} />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={(e) => handleStatusChange(item.id, 'new_lead', e)}>
                                          New Lead
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={(e) => handleStatusChange(item.id, 'contacted', e)}>
                                          Contacted
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={(e) => handleStatusChange(item.id, 'in_discussion', e)}>
                                          In Discussion
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={(e) => handleStatusChange(item.id, 'quoted', e)}>
                                          Quoted
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={(e) => handleStatusChange(item.id, 'awaiting_approval', e)}>
                                          Awaiting Approval
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={(e) => handleStatusChange(item.id, 'won', e)}>
                                          Won
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={(e) => handleStatusChange(item.id, 'lost', e)}>
                                          Lost
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                              </div>
                            </Link>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {extendedItem.assigned_to ? (
                                <>
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                                      {getInitials(extendedItem.assigned_to.full_name, extendedItem.assigned_to.email)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">{extendedItem.assigned_to.full_name || extendedItem.assigned_to.email}</span>
                                </>
                              ) : (
                                <span className="text-sm text-muted-foreground/50">Unassigned</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              {extendedItem.company_name ? (
                                <>
                                  <Building2 className="h-3.5 w-3.5" />
                                  {extendedItem.company_name}
                                </>
                              ) : (
                                <span className="text-muted-foreground/50">-</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="text-sm text-muted-foreground">
                              {item.customer_email || '-'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="text-sm text-muted-foreground">
                              {extendedItem.phone_number || '-'}
                            </span>
                          </td>
                          <td className="p-3">
                            {extendedItem.estimated_value ? (
                              <div className="flex items-center gap-1.5 text-sm font-medium">
                                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                                {extendedItem.estimated_value.toLocaleString()}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground/50">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="text-sm text-muted-foreground">
                              {item.next_follow_up_at
                                ? formatDistanceToNow(new Date(item.next_follow_up_at), { addSuffix: true })
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
                                <Link href={`/work-items/${item.id}?tab=activity&compose=true`}>
                                  <Mail className="h-4 w-4" />
                                </Link>
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem asChild>
                                    <Link href={`/work-items/${item.id}`}>View Details</Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <Link href={`/work-items/${item.id}?tab=activity&compose=true`}>Send Email</Link>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        No leads found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View - Shown on mobile only */}
            <div className="md:hidden p-3 space-y-3">
              {sortedWorkItems && sortedWorkItems.length > 0 ? (
                sortedWorkItems.map((item) => {
                  const extendedItem = item as any
                  return (
                    <Link key={item.id} href={`/work-items/${item.id}`}>
                      <Card className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Avatar className="h-12 w-12 shrink-0">
                              <AvatarFallback className="text-sm bg-gradient-to-br from-pink-500 to-purple-600 text-white">
                                {getInitials(item.customer_name, item.customer_email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-base mb-1">
                                {item.customer_name || item.customer_email || 'Unknown'}
                              </div>
                              <div className="mb-2" onClick={(e) => e.preventDefault()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="cursor-pointer hover:opacity-80 transition-opacity">
                                      <StatusBadge status={item.status} />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={(e) => handleStatusChange(item.id, 'new_lead', e)}>
                                      New Lead
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => handleStatusChange(item.id, 'contacted', e)}>
                                      Contacted
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => handleStatusChange(item.id, 'in_discussion', e)}>
                                      In Discussion
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => handleStatusChange(item.id, 'quoted', e)}>
                                      Quoted
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => handleStatusChange(item.id, 'awaiting_approval', e)}>
                                      Awaiting Approval
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={(e) => handleStatusChange(item.id, 'won', e)}>
                                      Won
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => handleStatusChange(item.id, 'lost', e)}>
                                      Lost
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              <div className="space-y-1.5 text-sm text-muted-foreground">
                                {extendedItem.company_name && (
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-3.5 w-3.5" />
                                    <span className="truncate">{extendedItem.company_name}</span>
                                  </div>
                                )}
                                {item.customer_email && (
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-3.5 w-3.5" />
                                    <span className="truncate">{item.customer_email}</span>
                                  </div>
                                )}
                                {extendedItem.phone_number && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-3.5 w-3.5" />
                                    <span>{extendedItem.phone_number}</span>
                                  </div>
                                )}
                                {extendedItem.estimated_value && (
                                  <div className="flex items-center gap-2 font-medium text-foreground">
                                    <DollarSign className="h-3.5 w-3.5" />
                                    <span>${extendedItem.estimated_value.toLocaleString()}</span>
                                  </div>
                                )}
                                {extendedItem.assigned_to && (
                                  <div className="flex items-center gap-2">
                                    <User className="h-3.5 w-3.5" />
                                    <span>Assigned to: {extendedItem.assigned_to.full_name || extendedItem.assigned_to.email}</span>
                                  </div>
                                )}
                              </div>

                              {item.next_follow_up_at && (
                                <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                                  Follow up {formatDistanceToNow(new Date(item.next_follow_up_at), { addSuffix: true })}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  No leads found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pipeline View - Kanban Board */}
      {viewMode === 'pipeline' && workItems && (
        <div className="overflow-x-auto">
          <KanbanBoard
            workItems={workItems}
            onStatusChange={async (itemId: string, newStatus: string) => {
              try {
                await updateStatusMutation.mutateAsync({
                  id: itemId,
                  status: newStatus,
                })
                toast.success('Status updated successfully')
              } catch (error) {
                toast.error('Failed to update status')
                console.error('Status update error:', error)
              }
            }}
          />
        </div>
      )}
    </div>
  )
}
