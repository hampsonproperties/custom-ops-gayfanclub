'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { useWorkItems, useUpdateWorkItemStatus, type PaginatedResult } from '@/lib/hooks/use-work-items'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { StatusBadge } from '@/components/custom/status-badge'
import { KanbanBoard } from '@/components/work-items/kanban-board'
import { Search, Filter, LayoutList, LayoutGrid, Mail, Phone, MoreHorizontal, Building2, DollarSign, ArrowUpDown, ArrowUp, ArrowDown, User, Users, Plus, Palette, Loader2, UserPlus, XCircle, Download } from 'lucide-react'
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
import { CreateProjectDialog } from '@/components/projects/create-project-dialog'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { AssignDesignerDialog } from '@/components/projects/assign-designer-dialog'
import { EventCountdownCompact } from '@/components/projects/event-countdown'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { getValidStatusesForWorkItem, getStatusLabel } from '@/lib/utils/status-transitions'
import { useCloseWorkItem } from '@/lib/hooks/use-work-items'
import type { WorkItemType, WorkItemStatus } from '@/types/database'
import { logger } from '@/lib/logger'
import { generateCSV, downloadCSV, exportFilename, type CSVColumn } from '@/lib/utils/csv-export'

const log = logger('work-items')

export default function WorkItemsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-muted-foreground">Loading...</div>}>
      <WorkItemsPageContent />
    </Suspense>
  )
}

function WorkItemsPageContent() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const shouldOpenNew = searchParams.get('new') === 'true'
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'pipeline'>('table')
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [filterMode, setFilterMode] = useState<'my-projects' | 'all-projects' | 'need-design'>('all-projects')
  const [typeFilter, setTypeFilter] = useState<'all' | 'customify_order' | 'assisted_project'>('all')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, filterMode, typeFilter])

  const { data: result, isLoading } = useWorkItems({
    search: debouncedSearch,
    assignedTo: filterMode === 'my-projects' ? 'me' : undefined,
    status: filterMode === 'need-design' ? 'new_inquiry,awaiting_approval' : undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
    ...(viewMode === 'table' ? { page, pageSize: PAGE_SIZE } : {}),
    sortColumn: sortColumn || undefined,
    sortDirection: sortColumn ? sortDirection : undefined,
  })

  const workItems = result?.items
  const totalCount = result?.totalCount ?? 0
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
      log.error('Status update error', { error })
    }
  }

  // Handler for column sorting (server-side)
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
    setPage(1)
  }

  const sortedWorkItems = workItems || []

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

  // ── Bulk action state ──
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
  const [bulkCloseOpen, setBulkCloseOpen] = useState(false)
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkCloseReason, setBulkCloseReason] = useState<string>('completed')
  const [bulkAssignDesignerId, setBulkAssignDesignerId] = useState<string>('unassigned')
  const closeWorkItem = useCloseWorkItem()

  // Fetch team members for bulk assign
  const { data: teamMembers } = useQuery({
    queryKey: ['users-for-assignment'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .order('full_name')
      if (error) throw error
      return data
    },
  })

  // Get selected work item objects
  const selectedWorkItems = sortedWorkItems.filter(item => selectedItems.has(item.id))

  // Compute valid statuses for bulk status change (intersection of all selected types,
  // excluding system-only and closing statuses)
  const getValidBulkStatuses = (): WorkItemStatus[] => {
    if (selectedWorkItems.length === 0) return []
    const SYSTEM_ONLY: string[] = ['batched', 'shipped']
    const CLOSING: string[] = ['closed', 'closed_won', 'closed_lost', 'closed_event_cancelled']
    const types = [...new Set(selectedWorkItems.map(item => item.type))]
    const statusSets = types.map(type =>
      new Set(getValidStatusesForWorkItem(type as WorkItemType))
    )
    let common = statusSets[0]
    for (let i = 1; i < statusSets.length; i++) {
      common = new Set([...common].filter(s => statusSets[i].has(s)))
    }
    return [...common].filter(
      s => !SYSTEM_ONLY.includes(s) && !CLOSING.includes(s)
    ) as WorkItemStatus[]
  }

  // ── Export CSV ──
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const supabase = createClient()
      let query = supabase
        .from('work_items')
        .select('*, customer:customers(display_name, email), assigned_to:users!assigned_to_user_id(full_name, email)')
        .is('closed_at', null)
        .order('created_at', { ascending: false })

      if (filterMode === 'my-projects') {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) query = query.eq('assigned_to_user_id', user.id)
      } else if (filterMode === 'need-design') {
        query = query.in('status', ['new_inquiry', 'awaiting_approval'])
      }

      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase()
        query = query.or(
          `customer_name.ilike.%${s}%,customer_email.ilike.%${s}%,shopify_order_number.ilike.%${s}%,design_fee_order_number.ilike.%${s}%,shopify_order_id.ilike.%${s}%,design_fee_order_id.ilike.%${s}%,title.ilike.%${s}%`
        )
      }

      if (sortColumn) {
        const sortMap: Record<string, string> = { name: 'customer_name', status: 'status', value: 'estimated_value', event_date: 'event_date', created: 'created_at' }
        query = query.order(sortMap[sortColumn] || 'created_at', { ascending: sortDirection === 'asc' })
      }

      const { data, error } = await query
      if (error) throw error

      const columns: CSVColumn<any>[] = [
        { header: 'Title', value: (r) => r.title || `Project for ${r.customer_name || r.customer_email || 'Unknown'}` },
        { header: 'Customer', value: (r) => r.customer_name },
        { header: 'Email', value: (r) => r.customer_email },
        { header: 'Status', value: (r) => getStatusLabel(r.status) },
        { header: 'Type', value: (r) => r.type?.replace(/_/g, ' ') },
        { header: 'Designer', value: (r) => r.assigned_to?.full_name || r.assigned_to?.email },
        { header: 'Est. Value', value: (r) => r.estimated_value },
        { header: 'Event Date', value: (r) => r.event_date ? new Date(r.event_date).toLocaleDateString() : '' },
        { header: 'Shopify Order #', value: (r) => r.shopify_order_number },
        { header: 'Created', value: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString() : '' },
      ]

      const csv = generateCSV(data || [], columns)
      downloadCSV(csv, exportFilename('work-items'))
      toast.success(`Exported ${data?.length || 0} projects`)
    } catch (err) {
      toast.error('Failed to export projects')
    } finally {
      setIsExporting(false)
    }
  }

  // ── Bulk action handlers ──

  const handleBulkStatusChange = async (newStatus: string) => {
    setBulkLoading(true)
    setBulkStatusOpen(false)
    const results = await Promise.allSettled(
      selectedWorkItems.map(item =>
        updateStatusMutation.mutateAsync({ id: item.id, status: newStatus })
      )
    )
    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[]
    if (failed.length === 0) {
      toast.success(`Status updated to "${getStatusLabel(newStatus as WorkItemStatus)}" for all ${succeeded} item${succeeded !== 1 ? 's' : ''}`)
    } else {
      const reasons = [...new Set(failed.map(r => r.reason?.message || 'Unknown error'))]
      toast.error(`${succeeded} succeeded, ${failed.length} failed`, {
        description: reasons.join('. '),
        duration: 8000,
      })
    }
    setSelectedItems(new Set())
    setBulkLoading(false)
  }

  const handleBulkClose = async () => {
    setBulkLoading(true)
    setBulkCloseOpen(false)
    const reason = bulkCloseReason as 'not_interested' | 'spam' | 'cancelled' | 'completed' | 'other'
    const results = await Promise.allSettled(
      selectedWorkItems.map(item =>
        closeWorkItem.mutateAsync({ workItemId: item.id, reason })
      )
    )
    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[]
    if (failed.length === 0) {
      toast.success(`Closed ${succeeded} item${succeeded !== 1 ? 's' : ''}`)
    } else {
      const reasons = [...new Set(failed.map(r => r.reason?.message || 'Unknown error'))]
      toast.error(`${succeeded} closed, ${failed.length} failed`, {
        description: reasons.join('. '),
        duration: 8000,
      })
    }
    setSelectedItems(new Set())
    setBulkLoading(false)
    setBulkCloseReason('completed')
    queryClient.invalidateQueries({ queryKey: ['work-items'] })
  }

  const handleBulkAssign = async () => {
    setBulkLoading(true)
    setBulkAssignOpen(false)
    const designerId = bulkAssignDesignerId === 'unassigned' ? null : bulkAssignDesignerId
    const supabase = createClient()
    const results = await Promise.allSettled(
      selectedWorkItems.map(async (item) => {
        const { error } = await supabase
          .from('work_items')
          .update({ assigned_to_user_id: designerId })
          .eq('id', item.id)
        if (error) throw error
      })
    )
    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[]
    const designer = teamMembers?.find(u => u.id === designerId)
    const designerName = designer ? (designer.full_name || designer.email) : 'Unassigned'
    if (failed.length === 0) {
      toast.success(`Assigned "${designerName}" to ${succeeded} item${succeeded !== 1 ? 's' : ''}`)
    } else {
      const reasons = [...new Set(failed.map(r => r.reason?.message || 'Unknown error'))]
      toast.error(`${succeeded} assigned, ${failed.length} failed`, {
        description: reasons.join('. '),
        duration: 8000,
      })
    }
    setSelectedItems(new Set())
    setBulkLoading(false)
    setBulkAssignDesignerId('unassigned')
    queryClient.invalidateQueries({ queryKey: ['work-items'] })
  }

  // Stats from full database (separate count queries, not current page)
  const { data: pageStats } = useQuery({
    queryKey: ['work-items', 'page-stats'],
    queryFn: async () => {
      const supabase = createClient()
      const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const today = new Date().toISOString()

      const [prodResult, eventResult, designResult] = await Promise.all([
        supabase.from('work_items').select('id', { count: 'exact', head: true })
          .is('closed_at', null)
          .in('status', ['in_production', 'approved']),
        supabase.from('work_items').select('id', { count: 'exact', head: true })
          .is('closed_at', null)
          .not('event_date', 'is', null)
          .gte('event_date', today)
          .lte('event_date', sevenDaysFromNow),
        supabase.from('work_items').select('id', { count: 'exact', head: true })
          .is('closed_at', null)
          .in('status', ['new_inquiry', 'awaiting_approval']),
      ])

      return {
        inProduction: prodResult.count ?? 0,
        upcomingEvents: eventResult.count ?? 0,
        needingDesign: designResult.count ?? 0,
      }
    },
  })

  const inProductionCount = pageStats?.inProduction ?? 0
  const upcomingEventsCount = pageStats?.upcomingEvents ?? 0
  const needingDesignCount = pageStats?.needingDesign ?? 0

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
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">All Projects</h1>
          <p className="text-muted-foreground">
            Track design and production status for all active projects
          </p>
        </div>
        <CreateProjectDialog
          defaultOpen={shouldOpenNew}
          onProjectCreated={() => {
            if (shouldOpenNew) router.replace('/work-items')
            queryClient.invalidateQueries({ queryKey: ['work-items'] })
          }}
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          }
        />
      </div>

      {/* Stats - Production Focused */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{inProductionCount}</div>
            <p className="text-xs text-muted-foreground">In Production</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">{upcomingEventsCount}</div>
            <p className="text-xs text-muted-foreground">Events This Week</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">{needingDesignCount}</div>
            <p className="text-xs text-muted-foreground">Awaiting Design</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            {/* Filter Toggle - Production Focused */}
            <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2">
              <Button
                variant={filterMode === 'my-projects' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('my-projects')}
                className="gap-1.5 h-9 text-xs sm:text-sm"
              >
                <User className="h-4 w-4 shrink-0" />
                <span className="truncate">My Projects</span>
              </Button>
              <Button
                variant={filterMode === 'all-projects' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('all-projects')}
                className="gap-1.5 h-9 text-xs sm:text-sm"
              >
                <Users className="h-4 w-4 shrink-0" />
                <span className="truncate">All Projects</span>
              </Button>
              <Button
                variant={filterMode === 'need-design' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('need-design')}
                className="gap-1.5 h-9 text-xs sm:text-sm"
              >
                <Palette className="h-4 w-4 shrink-0" />
                <span className="truncate">Needs Design</span>
              </Button>

              <div className="hidden sm:block h-6 w-px bg-border" />

              {/* Type Filter */}
              <Button
                variant={typeFilter === 'all' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setTypeFilter('all')}
                className="gap-1.5 h-9 text-xs sm:text-sm"
              >
                <span className="truncate">All Types</span>
              </Button>
              <Button
                variant={typeFilter === 'customify_order' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTypeFilter('customify_order')}
                className="gap-1.5 h-9 text-xs sm:text-sm"
              >
                <Filter className="h-4 w-4 shrink-0" />
                <span className="truncate">Customify</span>
              </Button>
              <Button
                variant={typeFilter === 'assisted_project' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTypeFilter('assisted_project')}
                className="gap-1.5 h-9 text-xs sm:text-sm"
              >
                <Filter className="h-4 w-4 shrink-0" />
                <span className="truncate">Assisted</span>
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
                <Button variant="outline" className="gap-2 flex-1 sm:flex-none h-11 sm:h-9" onClick={handleExport} disabled={isExporting}>
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  <span className="sm:inline">Export CSV</span>
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
                {/* Bulk Status Change */}
                <DropdownMenu open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={bulkLoading} className="h-9">
                      Change Status
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Set status to</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {getValidBulkStatuses().length > 0 ? (
                      getValidBulkStatuses().map(status => (
                        <DropdownMenuItem
                          key={status}
                          onClick={() => handleBulkStatusChange(status)}
                        >
                          {getStatusLabel(status)}
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <DropdownMenuItem disabled>
                        No common statuses for selected items
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Bulk Close */}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={bulkLoading}
                  onClick={() => setBulkCloseOpen(true)}
                  className="h-9"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Close
                </Button>

                {/* Bulk Assign Designer */}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={bulkLoading}
                  onClick={() => setBulkAssignOpen(true)}
                  className="h-9"
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Assign
                </Button>

                {bulkLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
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
                      Project Title
                    </th>
                    <th className="text-left p-3 font-medium text-sm">
                      Customer
                    </th>
                    <th className="text-left p-3 font-medium text-sm">
                      Designer
                    </th>
                    <th className="text-left p-3 font-medium text-sm">
                      Status
                    </th>
                    <th className="text-left p-3 font-medium text-sm">
                      Event Date
                    </th>
                    <th className="text-center p-3 font-medium text-sm">
                      Files
                    </th>
                    <th className="text-left p-3 font-medium text-sm">
                      Updated
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
                          {/* Checkbox */}
                          <td className="w-12 p-3">
                            <Checkbox
                              checked={selectedItems.has(item.id)}
                              onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)}
                              aria-label={`Select ${item.title || item.customer_name}`}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>

                          {/* Project Title */}
                          <td className="p-3">
                            <Link href={`/work-items/${item.id}`} className="hover:underline">
                              <p className="font-medium text-sm">
                                {item.title || `Project for ${item.customer_name || item.customer_email}`}
                              </p>
                            </Link>
                          </td>

                          {/* Customer (with link to customer page) */}
                          <td className="p-3">
                            {item.customer_id ? (
                              <Link href={`/customers/${item.customer_id}`} className="flex items-center gap-2 hover:underline">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-xs bg-primary/10">
                                    {getInitials(item.customer_name, item.customer_email)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm">{item.customer_name || item.customer_email}</span>
                              </Link>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-xs bg-gray-100">
                                    {getInitials(item.customer_name, item.customer_email)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-muted-foreground">{item.customer_name || item.customer_email}</span>
                              </div>
                            )}
                          </td>

                          {/* Designer */}
                          <td className="p-3">
                            {extendedItem.assigned_to ? (
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                                      {getInitials(extendedItem.assigned_to.full_name, extendedItem.assigned_to.email)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">{extendedItem.assigned_to.full_name || extendedItem.assigned_to.email}</span>
                                </div>
                                <AssignDesignerDialog
                                  projectId={item.id}
                                  currentDesignerId={extendedItem.assigned_to.id}
                                  trigger={
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => e.stopPropagation()}>
                                      <User className="h-3 w-3" />
                                    </Button>
                                  }
                                />
                              </div>
                            ) : (
                              <AssignDesignerDialog
                                projectId={item.id}
                                trigger={
                                  <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                                    <User className="mr-2 h-4 w-4" />
                                    Assign
                                  </Button>
                                }
                              />
                            )}
                          </td>

                          {/* Production Status */}
                          <td className="p-3">
                            <StatusBadge status={item.status} />
                          </td>

                          {/* Event Date */}
                          <td className="p-3">
                            {item.event_date ? (
                              <EventCountdownCompact eventDate={item.event_date} />
                            ) : (
                              <span className="text-sm text-muted-foreground/50">-</span>
                            )}
                          </td>

                          {/* Files Count */}
                          <td className="p-3 text-center">
                            {extendedItem.file_count ? (
                              <Badge variant="outline" className="text-xs">
                                {extendedItem.file_count}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground/50">0</span>
                            )}
                          </td>

                          {/* Last Updated */}
                          <td className="p-3">
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(item.updated_at || ''), { addSuffix: true })}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-1">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem asChild>
                                    <Link href={`/work-items/${item.id}`}>View Project</Link>
                                  </DropdownMenuItem>
                                  {item.customer_id && (
                                    <DropdownMenuItem asChild>
                                      <Link href={`/customers/${item.customer_id}`}>View Customer</Link>
                                    </DropdownMenuItem>
                                  )}
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
                        No projects found
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
            <PaginationControls
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={totalCount}
              onPageChange={setPage}
            />
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
                log.error('Status update error', { error })
              }
            }}
          />
        </div>
      )}

      {/* ── Bulk Close Confirmation Dialog ── */}
      <Dialog open={bulkCloseOpen} onOpenChange={setBulkCloseOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Close {selectedItems.size} Item{selectedItems.size !== 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              You are about to close <strong>{selectedItems.size}</strong> selected item{selectedItems.size !== 1 ? 's' : ''}.
              Closed items will no longer appear in the active projects list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <Label htmlFor="close-reason">Close Reason</Label>
              <Select value={bulkCloseReason} onValueChange={setBulkCloseReason}>
                <SelectTrigger id="close-reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="not_interested">Not Interested</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="spam">Spam</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkCloseOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkClose} disabled={bulkLoading}>
              {bulkLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Close {selectedItems.size} Item{selectedItems.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Assign Designer Dialog ── */}
      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Assign Designer</DialogTitle>
            <DialogDescription>
              Assign a designer to {selectedItems.size} selected item{selectedItems.size !== 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-designer">Designer</Label>
              <Select value={bulkAssignDesignerId} onValueChange={setBulkAssignDesignerId}>
                <SelectTrigger id="bulk-designer">
                  <SelectValue placeholder="Select designer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {teamMembers?.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAssignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkAssign} disabled={bulkLoading}>
              {bulkLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign to {selectedItems.size} Item{selectedItems.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
