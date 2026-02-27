'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useMarkFollowedUp,
  useToggleWaiting,
} from '@/lib/hooks/use-work-items'
import { SnoozeDialog } from './snooze-dialog'
import { toast } from 'sonner'
import {
  Clock,
  Check,
  ChevronDown,
  Pause,
  Play,
  AlertTriangle,
  UserPlus,
  Calendar,
  Edit3,
  XCircle,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import type { Database } from '@/types/database'

type WorkItem = Database['public']['Tables']['work_items']['Row']

interface FollowUpActionBarProps {
  workItem: WorkItem
  onChangeStatus?: () => void
  onCloseLead?: () => void
}

export function FollowUpActionBar({ workItem, onChangeStatus, onCloseLead }: FollowUpActionBarProps) {
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
    if (workItem.is_waiting) {
      return {
        text: 'Paused - Waiting on Customer',
        variant: 'muted' as const,
        isOverdue: false,
      }
    }

    if (!workItem.next_follow_up_at) {
      return {
        text: 'No follow-up scheduled',
        variant: 'muted' as const,
        isOverdue: false,
      }
    }

    const followUpDate = new Date(workItem.next_follow_up_at)
    const now = new Date()
    const isOverdue = followUpDate < now

    return {
      text: formatDistanceToNow(followUpDate, { addSuffix: true }),
      fullDate: format(followUpDate, 'PPP'),
      variant: isOverdue ? ('destructive' as const) : ('default' as const),
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
      fullDate: format(eventDate, 'PPP'),
      daysUntil,
      isRush: daysUntil < 30,
    }
  }

  const followUpInfo = getFollowUpDisplay()
  const eventInfo = getEventDisplay()

  return (
    <>
      <Card className={followUpInfo.isOverdue ? 'border-2 border-red-500 dark:border-red-600 bg-red-50/50 dark:bg-red-950/20' : ''}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left Side - Follow-Up Info & Badges */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Follow-Up Display - Enhanced for Overdue */}
                {followUpInfo.isOverdue ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 border-2 border-red-500 dark:border-red-600 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 animate-pulse" />
                    <span className="text-sm font-bold text-red-700 dark:text-red-300">
                      OVERDUE: {followUpInfo.text}
                    </span>
                  </div>
                ) : (
                  <div
                    className={`flex items-center gap-2 ${
                      workItem.is_waiting ? 'text-muted-foreground' : ''
                    }`}
                  >
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">
                      Follow-up: {followUpInfo.text}
                    </span>
                  </div>
                )}

                {/* Event Date */}
                {eventInfo && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <div
                      className={`flex items-center gap-2 text-sm ${
                        eventInfo.isRush ? 'text-orange-600 font-medium' : 'text-muted-foreground'
                      }`}
                      title={eventInfo.fullDate}
                    >
                      <Calendar className="h-4 w-4" />
                      <span>Event {eventInfo.text}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Status Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {workItem.requires_initial_contact && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                    <UserPlus className="mr-1 h-3 w-3" />
                    Needs Initial Contact
                  </Badge>
                )}

                {workItem.rush_order && (
                  <Badge variant="destructive">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Rush Order
                  </Badge>
                )}

                {workItem.missed_design_window && (
                  <Badge variant="destructive">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Missed Design Window
                  </Badge>
                )}

                {workItem.is_waiting && (
                  <Badge variant="outline">
                    <Pause className="mr-1 h-3 w-3" />
                    Waiting on Customer
                  </Badge>
                )}
              </div>
            </div>

            {/* Right Side - Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                size="sm"
                onClick={handleMarkFollowedUp}
                disabled={markFollowedUp.isPending || workItem.is_waiting}
              >
                <Check className="mr-2 h-4 w-4" />
                Mark Followed Up
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-2">
                    Actions
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {!workItem.closed_at && onChangeStatus && (
                    <>
                      <DropdownMenuItem onClick={onChangeStatus}>
                        <Edit3 className="h-4 w-4" />
                        <span>Change Status</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={() => setSnoozeDialogOpen(true)}>
                    <Clock className="h-4 w-4" />
                    <span>Snooze Follow-Up</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleToggleWaiting}>
                    {workItem.is_waiting ? (
                      <>
                        <Play className="h-4 w-4" />
                        <span>Resume Follow-Ups</span>
                      </>
                    ) : (
                      <>
                        <Pause className="h-4 w-4" />
                        <span>Mark as Waiting</span>
                      </>
                    )}
                  </DropdownMenuItem>
                  {!workItem.closed_at && onCloseLead && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onCloseLead} className="text-destructive focus:text-destructive">
                        <XCircle className="h-4 w-4" />
                        <span>Close Lead</span>
                      </DropdownMenuItem>
                    </>
                  )}
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
