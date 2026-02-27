'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { KanbanCard } from './kanban-card'
import type { Database } from '@/types/database'

type WorkItem = Database['public']['Tables']['work_items']['Row']

interface KanbanColumnProps {
  id: string
  label: string
  color: string
  items: WorkItem[]
  itemCount: number
}

export function KanbanColumn({ id, label, color, items, itemCount }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  })

  return (
    <div className="flex-shrink-0 w-[320px]">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${color}`} />
          <h3 className="font-semibold text-sm">{label}</h3>
        </div>
        <Badge variant="secondary" className="text-xs">
          {itemCount}
        </Badge>
      </div>

      {/* Droppable Area */}
      <div
        ref={setNodeRef}
        className={`min-h-[500px] rounded-lg p-2 transition-colors ${
          isOver ? 'bg-muted/50 border-2 border-dashed border-primary' : 'bg-muted/20'
        }`}
      >
        <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map(item => (
              <KanbanCard key={item.id} item={item} />
            ))}
            {items.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">
                Drop items here
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  )
}
