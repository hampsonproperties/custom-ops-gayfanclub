'use client'

import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Building2, DollarSign, Mail, Phone } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { KanbanColumn } from './kanban-column'
import { KanbanCard } from './kanban-card'
import type { Database } from '@/types/database'

type WorkItem = Database['public']['Tables']['work_items']['Row']

interface KanbanBoardProps {
  workItems: WorkItem[]
  onStatusChange: (itemId: string, newStatus: string) => Promise<void>
}

const STATUS_COLUMNS = [
  { id: 'new_lead', label: 'New Lead', color: 'bg-slate-500' },
  { id: 'contacted', label: 'Contacted', color: 'bg-blue-500' },
  { id: 'in_discussion', label: 'In Discussion', color: 'bg-purple-500' },
  { id: 'quoted', label: 'Quoted', color: 'bg-yellow-500' },
  { id: 'awaiting_approval', label: 'Awaiting Approval', color: 'bg-orange-500' },
  { id: 'won', label: 'Won', color: 'bg-green-500' },
  { id: 'lost', label: 'Lost', color: 'bg-red-500' },
]

export function KanbanBoard({ workItems, onStatusChange }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Group items by status
  const itemsByStatus = useMemo(() => {
    const groups: Record<string, WorkItem[]> = {}
    STATUS_COLUMNS.forEach(column => {
      groups[column.id] = []
    })

    workItems.forEach(item => {
      if (groups[item.status]) {
        groups[item.status].push(item)
      }
    })

    return groups
  }, [workItems])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    // We can add visual feedback here if needed
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Find the active item
    const activeItem = workItems.find(item => item.id === activeId)
    if (!activeItem) return

    // Determine the new status
    let newStatus = activeItem.status

    // Check if dropped over a column
    const column = STATUS_COLUMNS.find(col => col.id === overId)
    if (column) {
      newStatus = column.id
    } else {
      // Dropped over another item - find its status
      const overItem = workItems.find(item => item.id === overId)
      if (overItem) {
        newStatus = overItem.status
      }
    }

    // Only update if status changed
    if (newStatus !== activeItem.status) {
      await onStatusChange(activeId, newStatus)
    }
  }

  const activeItem = activeId ? workItems.find(item => item.id === activeId) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[600px]">
        {STATUS_COLUMNS.map(column => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            label={column.label}
            color={column.color}
            items={itemsByStatus[column.id] || []}
            itemCount={itemsByStatus[column.id]?.length || 0}
          />
        ))}
      </div>

      <DragOverlay>
        {activeItem ? (
          <Card className="w-[300px] opacity-90 rotate-2 shadow-lg">
            <CardContent className="p-3">
              <div className="font-medium text-sm truncate">
                {activeItem.customer_name || activeItem.customer_email || 'Unknown'}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
