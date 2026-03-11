'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  useOverdueFollowUps,
  useFollowUpToday,
  useDueThisWeek,
  useNeedsInitialContact,
  useRushOrders,
  useWaitingOnCustomer,
  useMarkFollowedUp,
  useUpdateWorkItemStatus,
} from '@/lib/hooks/use-work-items'
import { PaginationControls } from '@/components/ui/pagination-controls'
import {
  CheckCircle2,
  ExternalLink,
  Check,
  Search,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow, format } from 'date-fns'
import { setQueue } from '@/lib/hooks/use-queue-navigation'
import { toast } from 'sonner'

type WorkItem = any

const STATUS_OPTIONS = [
  { value: 'new_inquiry', label: 'New Inquiry', color: 'bg-blue-600' },
  { value: 'quote_sent', label: 'Quoted', color: 'bg-cyan-600' },
  { value: 'design_fee_sent', label: 'Fee Sent', color: 'bg-yellow-600' },
  { value: 'invoice_sent', label: 'Invoiced', color: 'bg-orange-600' },
  { value: 'awaiting_payment', label: 'Awaiting Payment', color: 'bg-red-600' },
]

export default function LeadsPage() {
  const { data: overdueItems = [] } = useOverdueFollowUps()
  const { data: todayItems = [] } = useFollowUpToday()
  const { data: weekItems = [] } = useDueThisWeek()
  const { data: needsContactItems = [] } = useNeedsInitialContact()
  const { data: rushItems = [] } = useRushOrders()
  const { data: waitingItems = [] } = useWaitingOnCustomer()
  const markFollowedUp = useMarkFollowedUp()
  const updateStatus = useUpdateWorkItemStatus()

  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  // Combine and deduplicate all leads
  const allLeads = useMemo(() => {
    const leadsMap = new Map()

    const addLeads = (items: WorkItem[], priority: number) => {
      items.forEach(item => {
        if (!leadsMap.has(item.id)) {
          leadsMap.set(item.id, { ...item, _priority: priority })
        }
      })
    }

    // Priority order: overdue > needs contact > due today > rush > due week > waiting
    addLeads(overdueItems, 1)
    addLeads(needsContactItems, 2)
    addLeads(todayItems, 3)
    addLeads(rushItems, 4)
    addLeads(weekItems, 5)
    addLeads(waitingItems, 6)

    return Array.from(leadsMap.values()).sort((a, b) => a._priority - b._priority)
  }, [overdueItems, todayItems, weekItems, needsContactItems, rushItems, waitingItems])

  // Filter leads by search query
  const filteredLeads = useMemo(() => {
    if (!searchQuery) return allLeads

    const query = searchQuery.toLowerCase()
    return allLeads.filter(item =>
      item.customer_name?.toLowerCase().includes(query) ||
      item.customer_email?.toLowerCase().includes(query) ||
      item.title?.toLowerCase().includes(query)
    )
  }, [allLeads, searchQuery])

  // Client-side pagination of combined results
  const paginatedLeads = useMemo(() => {
    const from = (page - 1) * PAGE_SIZE
    return filteredLeads.slice(from, from + PAGE_SIZE)
  }, [filteredLeads, page])

  // Reset page when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setPage(1)
  }

  const handleMarkFollowedUp = async (workItemId: string) => {
    try {
      await markFollowedUp.mutateAsync(workItemId)
      toast.success('Marked as followed up')
    } catch (error) {
      toast.error('Failed to mark as followed up')
    }
  }

  const handleStatusChange = async (workItemId: string, newStatus: string) => {
    try {
      await updateStatus.mutateAsync({
        id: workItemId,
        status: newStatus,
        note: `Status changed to ${STATUS_OPTIONS.find(s => s.value === newStatus)?.label}`,
      })
      toast.success('Status updated')
    } catch (error) {
      toast.error('Failed to update status')
    }
  }

  const getPipelineStage = (item: WorkItem) => {
    if (item.requires_initial_contact) return { label: 'New Lead', color: 'bg-purple-600', value: 'new_inquiry' }
    const option = STATUS_OPTIONS.find(s => s.value === item.status)
    if (option) return option
    return { label: 'In Progress', color: 'bg-gray-600', value: item.status }
  }

  const getActionNeeded = (item: WorkItem) => {
    if (item.requires_initial_contact) return 'Send initial contact email'
    if (item.status === 'invoice_sent') return 'Follow up on payment'
    if (item.status === 'design_fee_sent') return 'Follow up on design fee'
    if (item.status === 'new_inquiry') return 'Send quote/pricing info'
    if (item.status === 'quote_sent') return 'Check if they have questions'
    if (item.status === 'awaiting_payment') return 'Chase payment'
    return 'Check in with customer'
  }

  const getLastActivity = (item: WorkItem) => {
    if (item.last_contact_at) {
      return `Last contact ${formatDistanceToNow(new Date(item.last_contact_at), { addSuffix: true })}`
    }
    if (item.created_at) {
      return `Created ${formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}`
    }
    return 'No activity'
  }

  const getEventDisplay = (item: WorkItem) => {
    if (!item.event_date) return null

    const eventDate = new Date(item.event_date)
    const now = new Date()
    const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    return {
      text: format(eventDate, 'MMM d'),
      daysUntil,
      isRush: daysUntil < 30,
    }
  }

  const getPriorityBadge = (item: WorkItem) => {
    if (overdueItems.find(i => i.id === item.id)) {
      return <Badge variant="destructive" className="text-xs">Overdue</Badge>
    }
    if (needsContactItems.find(i => i.id === item.id)) {
      return <Badge className="text-xs bg-purple-600">New</Badge>
    }
    if (todayItems.find(i => i.id === item.id)) {
      return <Badge className="text-xs bg-yellow-600">Due Today</Badge>
    }
    if (rushItems.find(i => i.id === item.id)) {
      return <Badge className="text-xs bg-orange-600">Rush</Badge>
    }
    return null
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Action Items</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Projects that need your attention — overdue follow-ups, new leads, rush orders, and items waiting on customers.
            The Dashboard morning briefing shows customer-level check-ins; this page shows every individual project.
          </p>
        </div>
        <Badge variant="secondary" className="text-sm sm:text-lg px-3 sm:px-4 py-1.5 sm:py-2 self-start sm:self-auto">
          {allLeads.length} item{allLeads.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name or email..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Empty State */}
      {filteredLeads.length === 0 && !searchQuery && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
            <p className="text-muted-foreground text-center max-w-md">
              No projects need your attention right now. Great work!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Search Empty State */}
      {filteredLeads.length === 0 && searchQuery && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">No action items match your search.</p>
          </CardContent>
        </Card>
      )}

      {/* Leads Table */}
      {filteredLeads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Projects Needing Attention</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Customer</TableHead>
                  <TableHead className="w-[180px]">Pipeline Stage</TableHead>
                  <TableHead className="w-[180px]">Last Activity</TableHead>
                  <TableHead>Next Action</TableHead>
                  <TableHead className="w-[100px]">Event</TableHead>
                  <TableHead className="w-[160px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.map((item) => {
                  const pipelineStage = getPipelineStage(item)
                  const eventInfo = getEventDisplay(item)
                  const priorityBadge = getPriorityBadge(item)
                  const lastActivity = getLastActivity(item)

                  return (
                    <TableRow key={item.id} className="hover:bg-muted/50">
                      <TableCell className="py-4">
                        <div className="space-y-1.5">
                          <Link
                            href={`/work-items/${item.id}`}
                            className="font-medium hover:underline flex items-center gap-1.5"
                          >
                            {item.customer?.display_name || item.customer_name || 'Unnamed Customer'}
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </Link>
                          <div className="text-xs text-muted-foreground truncate">
                            {item.customer?.email || item.customer_email}
                          </div>
                          {priorityBadge && (
                            <div className="flex gap-1 flex-wrap pt-0.5">
                              {priorityBadge}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="py-4">
                        <Select
                          value={item.status}
                          onValueChange={(value) => handleStatusChange(item.id, value)}
                          disabled={updateStatus.isPending}
                        >
                          <SelectTrigger className="h-9 text-sm font-medium w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                <span className="flex items-center gap-2">
                                  <span className={`h-2 w-2 rounded-full ${option.color}`} />
                                  {option.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      <TableCell className="py-4">
                        <div className="text-sm text-muted-foreground">
                          {lastActivity}
                        </div>
                      </TableCell>

                      <TableCell className="py-4">
                        <div className="text-sm">
                          {getActionNeeded(item)}
                        </div>
                      </TableCell>

                      <TableCell className="py-4">
                        {eventInfo ? (
                          <div className="text-xs space-y-0.5">
                            <div className={eventInfo.isRush ? 'text-orange-600 font-medium' : 'text-muted-foreground'}>
                              {eventInfo.text}
                            </div>
                            <div className={eventInfo.isRush ? 'text-orange-600' : 'text-muted-foreground'}>
                              ({eventInfo.daysUntil}d)
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkFollowedUp(item.id)}
                            disabled={markFollowedUp.isPending}
                            className="h-9 text-sm"
                          >
                            <Check className="h-4 w-4 mr-1.5" />
                            Done
                          </Button>
                          <Link href={`/work-items/${item.id}`} onClick={() => setQueue({ source: 'Action Items', type: 'work-item', ids: paginatedLeads.map(x => x.id) })}>
                            <Button size="sm" className="h-9 text-sm">
                              View
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden p-3 space-y-3">
              {paginatedLeads.map((item) => {
                const pipelineStage = getPipelineStage(item)
                const eventInfo = getEventDisplay(item)
                const priorityBadge = getPriorityBadge(item)
                const lastActivity = getLastActivity(item)

                return (
                  <div key={item.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/work-items/${item.id}`}
                          className="font-medium text-base hover:underline"
                        >
                          {item.customer?.display_name || item.customer_name || 'Unnamed Customer'}
                        </Link>
                        <div className="text-sm text-muted-foreground truncate mt-0.5">
                          {item.customer?.email || item.customer_email}
                        </div>
                      </div>
                      {priorityBadge}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-xs text-white ${pipelineStage.color}`}>
                        {pipelineStage.label}
                      </Badge>
                      {eventInfo && (
                        <Badge variant="outline" className={`text-xs ${eventInfo.isRush ? 'border-orange-300 text-orange-600' : ''}`}>
                          {eventInfo.text} ({eventInfo.daysUntil}d)
                        </Badge>
                      )}
                    </div>

                    <div className="text-sm text-muted-foreground">{lastActivity}</div>
                    <div className="text-sm">{getActionNeeded(item)}</div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkFollowedUp(item.id)}
                        disabled={markFollowedUp.isPending}
                        className="h-9 flex-1"
                      >
                        <Check className="h-4 w-4 mr-1.5" />
                        Done
                      </Button>
                      <Link href={`/work-items/${item.id}`} className="flex-1" onClick={() => setQueue({ source: 'Action Items', type: 'work-item', ids: paginatedLeads.map(x => x.id) })}>
                        <Button size="sm" className="h-9 w-full">
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>

            <PaginationControls
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={filteredLeads.length}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
