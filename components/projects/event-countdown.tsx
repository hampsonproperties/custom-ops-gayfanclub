'use client'

/**
 * Event Countdown Component
 * Shows event date with urgency indicators
 * - Red: Less than 7 days away or overdue
 * - Yellow: 7-14 days away
 * - Normal: More than 14 days away
 */

import { differenceInDays, format, isPast } from 'date-fns'
import { Calendar, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface EventCountdownProps {
  eventDate: string
  className?: string
  showIcon?: boolean
}

export function EventCountdown({ eventDate, className, showIcon = true }: EventCountdownProps) {
  const date = new Date(eventDate)
  const daysUntil = differenceInDays(date, new Date())
  const hasPassed = isPast(date)

  // Urgency levels
  const isUrgent = daysUntil <= 7 && daysUntil >= 0 // Less than 7 days
  const isWarning = daysUntil <= 14 && daysUntil > 7 // 7-14 days
  const isOverdue = hasPassed

  const getVariant = () => {
    if (isOverdue) return 'destructive'
    if (isUrgent) return 'destructive'
    if (isWarning) return 'secondary'
    return 'outline'
  }

  const getLabel = () => {
    if (isOverdue) return `${Math.abs(daysUntil)} days ago`
    if (daysUntil === 0) return 'Today!'
    if (daysUntil === 1) return 'Tomorrow'
    return `${daysUntil} days`
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showIcon && (
        <>
          {isUrgent || isOverdue ? (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          ) : (
            <Calendar className="h-4 w-4 text-muted-foreground" />
          )}
        </>
      )}
      <div className="flex flex-col">
        <div className="text-sm font-medium">
          {format(date, 'MMM d, yyyy')}
        </div>
        <Badge variant={getVariant()} className="text-xs w-fit">
          {getLabel()}
        </Badge>
      </div>
    </div>
  )
}

/**
 * Compact version for tables
 * Shows date and countdown in a condensed format
 */
export function EventCountdownCompact({ eventDate }: { eventDate: string }) {
  const date = new Date(eventDate)
  const daysUntil = differenceInDays(date, new Date())
  const isUrgent = daysUntil <= 7 && daysUntil >= 0
  const isOverdue = isPast(date)

  return (
    <div className="flex flex-col">
      <div className="text-sm">{format(date, 'MMM d, yyyy')}</div>
      <div className={cn(
        'text-xs',
        isOverdue && 'text-red-600 font-medium',
        isUrgent && 'text-orange-600 font-medium',
        !isOverdue && !isUrgent && 'text-muted-foreground'
      )}>
        {isOverdue ? `${Math.abs(daysUntil)} days ago` :
         daysUntil === 0 ? 'Today!' :
         daysUntil === 1 ? 'Tomorrow' :
         `${daysUntil} days`}
      </div>
    </div>
  )
}
