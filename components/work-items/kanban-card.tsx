'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Building2, DollarSign, Clock, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import type { Database } from '@/types/database'

type WorkItem = Database['public']['Tables']['work_items']['Row']

interface KanbanCardProps {
  item: WorkItem
}

export function KanbanCard({ item }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const extendedItem = item as any

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

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Link href={`/work-items/${item.id}`}>
        <Card className="hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing">
          <CardContent className="p-3 space-y-2">
            {/* Header with Avatar */}
            <div className="flex items-start gap-2">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs bg-gradient-to-br from-pink-500 to-purple-600 text-white">
                  {getInitials(extendedItem.customer?.display_name || item.customer_name, extendedItem.customer?.email || item.customer_email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {extendedItem.customer?.display_name || item.customer_name || extendedItem.customer?.email || item.customer_email || 'Unknown'}
                </p>
                {(extendedItem.customer?.email || item.customer_email) && (
                  <p className="text-xs text-muted-foreground truncate">
                    {extendedItem.customer?.email || item.customer_email}
                  </p>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="space-y-1.5 text-xs">
              {(extendedItem.customer?.organization_name || extendedItem.company_name) && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Building2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">{extendedItem.customer?.organization_name || extendedItem.company_name}</span>
                </div>
              )}
              {extendedItem.estimated_value && (
                <div className="flex items-center gap-1.5 font-medium">
                  <DollarSign className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span>${extendedItem.estimated_value.toLocaleString()}</span>
                </div>
              )}
              {extendedItem.assigned_to && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <User className="h-3 w-3 shrink-0" />
                  <span className="truncate">{extendedItem.assigned_to.full_name || extendedItem.assigned_to.email}</span>
                </div>
              )}
              {item.next_follow_up_at && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {formatDistanceToNow(new Date(item.next_follow_up_at), { addSuffix: true })}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}
