'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/custom/status-badge'
import {
  useMarkFollowedUp,
  useToggleWaiting,
} from '@/lib/hooks/use-work-items'
import { SnoozeDialog } from './snooze-dialog'
import { toast } from 'sonner'
import {
  Clock,
  Check,
  MoreVertical,
  ExternalLink,
  Calendar,
  AlertTriangle,
  Pause,
  Play,
  ChevronDown,
  Mail,
  MessageSquare,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import { parseEmailAddress, extractEmailPreview } from '@/lib/utils/email-formatting'

type WorkItem = Database['public']['Tables']['work_items']['Row']
type Communication = Database['public']['Tables']['communications']['Row']

interface FollowUpItemCardProps {
  workItem: WorkItem
  showEventDate?: boolean
  showFollowUpDate?: boolean
}

export function FollowUpItemCard({
  workItem,
  showEventDate = true,
  showFollowUpDate = true,
}: FollowUpItemCardProps) {
  const [snoozeDialogOpen, setSnoozeDialogOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [lastComm, setLastComm] = useState<Communication | null>(null)
  const [loadingComm, setLoadingComm] = useState(false)
  const markFollowedUp = useMarkFollowedUp()
  const toggleWaiting = useToggleWaiting()

  // Fetch last communication when expanded
  useEffect(() => {
    if (!isExpanded) return

    let isMounted = true
    const supabase = createClient()

    const fetchComm = async () => {
      setLoadingComm(true)

      try {
        // First, try to get the last INBOUND email (customer's message to us)
        const { data: inboundData, error: inboundError } = await supabase
          .from('communications')
          .select('*')
          .eq('work_item_id', workItem.id)
          .eq('direction', 'inbound')
          .order('received_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (inboundError) throw inboundError

        // If we have an inbound email, use that
        if (inboundData) {
          if (isMounted) {
            setLastComm(inboundData)
            setLoadingComm(false)
          }
          return
        }

        // Otherwise, fall back to most recent communication (could be outbound)
        const { data: anyData, error: anyError } = await supabase
          .from('communications')
          .select('*')
          .eq('work_item_id', workItem.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (anyError) throw anyError

        if (isMounted) {
          setLastComm(anyData)
          setLoadingComm(false)
        }
      } catch (error) {
        console.error('Error fetching communication:', error)
        if (isMounted) {
          setLoadingComm(false)
        }
      }
    }

    fetchComm()

    return () => {
      isMounted = false
    }
  }, [isExpanded, workItem.id])

  const handleMarkFollowedUp = async () => {
    try {
      await markFollowedUp.mutateAsync(workItem.id)
      toast.success('Marked as followed up')
    } catch (error) {
      console.error('Mark followed up error:', error)
      toast.error('Failed to mark as followed up')
    }
  }

  const handleToggleWaiting = async () => {
    try {
      await toggleWaiting.mutateAsync(workItem.id)
      toast.success(
        workItem.is_waiting
          ? 'Resumed follow-ups'
          : 'Paused - waiting on customer'
      )
    } catch (error) {
      console.error('Toggle waiting error:', error)
      toast.error('Failed to toggle waiting status')
    }
  }

  const getFollowUpDisplay = () => {
    if (!workItem.next_follow_up_at) return null

    const followUpDate = new Date(workItem.next_follow_up_at)
    const now = new Date()
    const isOverdue = followUpDate < now
    const distance = formatDistanceToNow(followUpDate)

    return {
      text: isOverdue ? `Overdue by ${distance}` : `Due in ${distance}`,
      isOverdue,
    }
  }

  const getActionNeeded = () => {
    const status = workItem.status

    if (workItem.requires_initial_contact) {
      return 'Send initial contact email'
    }

    if (status === 'proof_sent' || status === 'awaiting_approval') {
      return 'Follow up on proof approval'
    }

    if (status === 'invoice_sent') {
      return 'Follow up on payment'
    }

    if (status === 'deposit_paid_ready_for_batch') {
      return 'Ready for batch - awaiting final payment'
    }

    if (status === 'on_payment_terms_ready_for_batch') {
      return 'Ready for batch - payment on terms'
    }

    if (status === 'design_fee_sent') {
      return 'Follow up on design fee payment'
    }

    if (status === 'new_inquiry') {
      return 'Send initial information'
    }

    if (status === 'info_sent') {
      return 'Check if they have questions'
    }

    if (status === 'needs_customer_fix') {
      return 'Remind about needed fixes'
    }

    return 'Check in with customer'
  }

  const getEventDisplay = () => {
    if (!workItem.event_date) return null

    const eventDate = new Date(workItem.event_date)
    const now = new Date()
    const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    return {
      text: formatDistanceToNow(eventDate, { addSuffix: true }),
      daysUntil,
      isRush: daysUntil < 30,
    }
  }

  const followUpInfo = getFollowUpDisplay()
  const eventInfo = getEventDisplay()

  const actionNeeded = getActionNeeded()

  return (
    <>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              {/* Main Content */}
              <div className="flex-1 min-w-0 space-y-2">
                {/* Customer Name & Type */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/work-items/${workItem.id}`}
                    className="font-medium hover:underline truncate"
                  >
                    {workItem.customer_name || 'Unnamed Customer'}
                  </Link>
                  <Badge variant="outline" className="text-xs">
                    {workItem.type === 'customify_order'
                      ? 'Customify'
                      : 'Custom Design'}
                  </Badge>
                </div>

                {/* Action Needed */}
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-600">
                    {actionNeeded}
                  </span>
                </div>

                {/* Status & Flags */}
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={workItem.status} />

                  {workItem.requires_initial_contact && (
                    <Badge variant="secondary" className="text-xs">
                      Needs Initial Contact
                    </Badge>
                  )}

                  {workItem.rush_order && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      Rush
                    </Badge>
                  )}

                  {workItem.is_waiting && (
                    <Badge variant="outline" className="text-xs">
                      <Pause className="mr-1 h-3 w-3" />
                      Waiting
                    </Badge>
                  )}
                </div>

                {/* Dates */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                  {showFollowUpDate && followUpInfo && (
                    <div
                      className={`flex items-center gap-1 ${
                        followUpInfo.isOverdue ? 'text-destructive font-medium' : ''
                      }`}
                    >
                      <Clock className="h-3 w-3" />
                      <span>{followUpInfo.text}</span>
                    </div>
                  )}

                  {showEventDate && eventInfo && (
                    <div
                      className={`flex items-center gap-1 ${
                        eventInfo.isRush ? 'text-orange-600 font-medium' : ''
                      }`}
                    >
                      <Calendar className="h-3 w-3" />
                      <span>Event {eventInfo.text}</span>
                    </div>
                  )}

                  {workItem.last_contact_at && (
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      <span>
                        Last contact {formatDistanceToNow(new Date(workItem.last_contact_at), { addSuffix: true })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Expand for details */}
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-xs h-auto py-1 px-2">
                    <ChevronDown
                      className={`h-3 w-3 mr-1 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                    {isExpanded ? 'Hide details' : 'Show last communication'}
                  </Button>
                </CollapsibleTrigger>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  onClick={handleMarkFollowedUp}
                  disabled={markFollowedUp.isPending}
                >
                  <Check className="mr-1 h-4 w-4" />
                  Followed Up
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSnoozeDialogOpen(true)}>
                      <Clock className="mr-2 h-4 w-4" />
                      Snooze
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleToggleWaiting}>
                      {workItem.is_waiting ? (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          Resume
                        </>
                      ) : (
                        <>
                          <Pause className="mr-2 h-4 w-4" />
                          Mark Waiting
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/work-items/${workItem.id}`}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open Work Item
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Expanded Content - Last Communication */}
            <CollapsibleContent>
              <div className="mt-4 pt-4 border-t space-y-3">
                {loadingComm && (
                  <div className="text-sm text-muted-foreground">
                    Loading last communication...
                  </div>
                )}

                {!loadingComm && lastComm && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {lastComm.direction === 'inbound'
                          ? `From ${parseEmailAddress(lastComm.from_email).displayName}`
                          : `You sent to ${parseEmailAddress(lastComm.to_emails[0] || lastComm.from_email).displayName}`}
                      </span>
                      <span className="text-muted-foreground">
                        • {format(new Date(lastComm.received_at || lastComm.sent_at!), 'MMM d, yyyy h:mm a')}
                      </span>
                      {lastComm.direction === 'inbound' && (
                        <Badge variant="secondary" className="text-xs">
                          Customer Reply
                        </Badge>
                      )}
                    </div>

                    <div className="text-sm">
                      <div className="font-medium text-muted-foreground mb-1">
                        Subject: {lastComm.subject || '(no subject)'}
                      </div>
                      <div className={`p-3 rounded-md text-sm leading-relaxed ${
                        lastComm.direction === 'inbound'
                          ? 'bg-blue-50 border border-blue-200'
                          : 'bg-muted/50'
                      }`}>
                        {extractEmailPreview(lastComm.body_html, lastComm.body_preview, 200)}
                      </div>
                    </div>

                    {workItem.customer_email && (
                      <div className="text-xs text-muted-foreground">
                        Customer email: {parseEmailAddress(workItem.customer_email).displayName}
                      </div>
                    )}
                  </div>
                )}

                {!loadingComm && !lastComm && (
                  <div className="text-sm text-muted-foreground">
                    No communications found for this work item.
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </CardContent>
        </Card>
      </Collapsible>

      <SnoozeDialog
        workItemId={workItem.id}
        workItemName={workItem.customer_name || 'this work item'}
        isOpen={snoozeDialogOpen}
        onOpenChange={setSnoozeDialogOpen}
      />
    </>
  )
}
