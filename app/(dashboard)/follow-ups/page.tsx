'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/custom/status-badge'
import {
  useOverdueFollowUps,
  useFollowUpToday,
  useDueThisWeek,
  useNeedsInitialContact,
  useRushOrders,
  useWaitingOnCustomer,
  useMarkFollowedUp,
} from '@/lib/hooks/use-work-items'
import {
  AlertCircle,
  Calendar,
  Clock,
  CheckCircle2,
  ExternalLink,
  Check,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow, format } from 'date-fns'
import { toast } from 'sonner'

type WorkItem = any

export default function LeadsPage() {
  const { data: overdueItems = [] } = useOverdueFollowUps()
  const { data: todayItems = [] } = useFollowUpToday()
  const { data: weekItems = [] } = useDueThisWeek()
  const { data: needsContactItems = [] } = useNeedsInitialContact()
  const { data: rushItems = [] } = useRushOrders()
  const { data: waitingItems = [] } = useWaitingOnCustomer()
  const markFollowedUp = useMarkFollowedUp()

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

  const handleMarkFollowedUp = async (workItemId: string) => {
    try {
      await markFollowedUp.mutateAsync(workItemId)
      toast.success('Marked as followed up')
    } catch (error) {
      toast.error('Failed to mark as followed up')
    }
  }

  const getPipelineStage = (item: WorkItem) => {
    // Map database status to friendly pipeline stages
    if (item.requires_initial_contact) return { label: 'New Lead', color: 'bg-purple-600' }
    if (item.status === 'new_inquiry') return { label: 'Contacted', color: 'bg-blue-600' }
    if (item.status === 'quote_sent') return { label: 'Quoted', color: 'bg-cyan-600' }
    if (item.status === 'design_fee_sent') return { label: 'Fee Sent', color: 'bg-yellow-600' }
    if (item.status === 'invoice_sent') return { label: 'Invoiced', color: 'bg-orange-600' }
    if (item.status === 'awaiting_payment') return { label: 'Awaiting Payment', color: 'bg-red-600' }
    return { label: 'In Progress', color: 'bg-gray-600' }
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

  const getFollowUpDisplay = (item: WorkItem) => {
    if (!item.next_follow_up_at) return { text: 'Not scheduled', isOverdue: false }

    const followUpDate = new Date(item.next_follow_up_at)
    const now = new Date()
    const isOverdue = followUpDate < now

    return {
      text: format(followUpDate, 'MMM d, yyyy'),
      relativeTime: formatDistanceToNow(followUpDate, { addSuffix: true }),
      isOverdue,
    }
  }

  const getEventDisplay = (item: WorkItem) => {
    if (!item.event_date) return null

    const eventDate = new Date(item.event_date)
    const now = new Date()
    const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    return {
      text: format(eventDate, 'MMM d, yyyy'),
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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Leads</h1>
          <p className="text-muted-foreground mt-2">
            Active inquiries and sales pipeline - close deals and convert to orders
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {allLeads.length} total leads
        </Badge>
      </div>

      {/* Empty State */}
      {allLeads.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
            <p className="text-muted-foreground text-center max-w-md">
              No sales leads need your attention right now. Great work!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Leads Table */}
      {allLeads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All Leads</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Pipeline Stage</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Next Action</TableHead>
                  <TableHead>Event Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allLeads.map((item) => {
                  const pipelineStage = getPipelineStage(item)
                  const eventInfo = getEventDisplay(item)
                  const priorityBadge = getPriorityBadge(item)
                  const lastActivity = getLastActivity(item)

                  return (
                    <TableRow key={item.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="space-y-1">
                          <Link
                            href={`/work-items/${item.id}`}
                            className="font-medium hover:underline flex items-center gap-2"
                          >
                            {item.customer_name || 'Unnamed Customer'}
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {item.customer_email}
                          </div>
                          {priorityBadge && <div className="mt-1">{priorityBadge}</div>}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge className={`${pipelineStage.color} text-white`}>
                          {pipelineStage.label}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {lastActivity}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm">
                          {getActionNeeded(item)}
                        </div>
                      </TableCell>

                      <TableCell>
                        {eventInfo ? (
                          <div className="space-y-1">
                            <div className={`text-sm ${eventInfo.isRush ? 'text-orange-600 font-medium' : ''}`}>
                              {eventInfo.text}
                            </div>
                            <div className={`text-xs ${eventInfo.isRush ? 'text-orange-600' : 'text-muted-foreground'}`}>
                              {eventInfo.daysUntil > 0 ? `${eventInfo.daysUntil} days` : 'Past due'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No event</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkFollowedUp(item.id)}
                            disabled={markFollowedUp.isPending}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Done
                          </Button>
                          <Link href={`/work-items/${item.id}`}>
                            <Button size="sm">
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}
