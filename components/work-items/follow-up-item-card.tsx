'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Database } from '@/types/database'

type WorkItem = Database['public']['Tables']['work_items']['Row']

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
  const markFollowedUp = useMarkFollowedUp()
  const toggleWaiting = useToggleWaiting()

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

    return {
      text: formatDistanceToNow(followUpDate, { addSuffix: true }),
      isOverdue,
    }
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

  return (
    <>
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
                    <span>Follow-up {followUpInfo.text}</span>
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
              </div>

              {/* Title / Email */}
              {(workItem.title || workItem.customer_email) && (
                <div className="text-sm text-muted-foreground truncate">
                  {workItem.title || workItem.customer_email}
                </div>
              )}
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
        </CardContent>
      </Card>

      <SnoozeDialog
        workItemId={workItem.id}
        workItemName={workItem.customer_name || 'this work item'}
        isOpen={snoozeDialogOpen}
        onOpenChange={setSnoozeDialogOpen}
      />
    </>
  )
}
