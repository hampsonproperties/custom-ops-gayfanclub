'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, PointerSensor, useSensor, useSensors, useDroppable, Modifier, pointerWithin, rectIntersection } from '@dnd-kit/core'
import { snapCenterToCursor } from '@dnd-kit/modifiers'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MessageSquare, Calendar, User as UserIcon } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// Sales stages definition
const SALES_STAGES = [
  { id: 'new_lead', label: 'New Lead', color: 'bg-gray-100 text-gray-700' },
  { id: 'contacted', label: 'Contacted', color: 'bg-blue-100 text-blue-700' },
  { id: 'in_discussion', label: 'In Discussion', color: 'bg-purple-100 text-purple-700' },
  { id: 'quoted', label: 'Quoted', color: 'bg-yellow-100 text-yellow-700' },
  { id: 'negotiating', label: 'Negotiating', color: 'bg-orange-100 text-orange-700' },
  { id: 'won', label: 'Won', color: 'bg-green-100 text-green-700' },
  { id: 'active_customer', label: 'Active Customer', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'lost', label: 'Lost', color: 'bg-red-100 text-red-700' },
] as const

type SalesStage = typeof SALES_STAGES[number]['id']

interface Customer {
  id: string
  display_name: string | null
  email: string
  sales_stage: SalesStage
  created_at: string
  updated_at: string
  project_count?: number
  last_contact?: string
}

interface CustomerCardProps {
  customer: Customer
  isDragging?: boolean
}

function CustomerCard({ customer, isDragging = false }: CustomerCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: customer.id,
    disabled: isDragging,
  })

  const style = isDragging ? undefined : {
    transform: CSS.Transform.toString(transform),
    transition: isSortableDragging ? undefined : transition,
  }

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return (email || 'U').charAt(0).toUpperCase()
  }

  const cardContent = (
    <Card className={cn(
      "p-3 transition-shadow bg-white border border-gray-200",
      !isDragging && "hover:shadow-md",
      isDragging && "shadow-xl"
    )}>
      <div className="space-y-2">
        {/* Customer Name and Avatar */}
        <div className="flex items-start gap-2">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
              {getInitials(customer.display_name, customer.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">
              {customer.display_name || customer.email}
            </div>
            {customer.display_name && (
              <div className="text-xs text-muted-foreground truncate">
                {customer.email}
              </div>
            )}
          </div>
        </div>

        {/* Project Count */}
        {customer.project_count !== undefined && customer.project_count > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <UserIcon className="h-3 w-3" />
            <span>{customer.project_count} {customer.project_count === 1 ? 'project' : 'projects'}</span>
          </div>
        )}

        {/* Last Contact */}
        {customer.last_contact && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            <span>Last contact {formatDistanceToNow(new Date(customer.last_contact), { addSuffix: true })}</span>
          </div>
        )}

        {/* Updated */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>Updated {formatDistanceToNow(new Date(customer.updated_at), { addSuffix: true })}</span>
        </div>
      </div>
    </Card>
  )

  // When dragging (in overlay), render without sortable wrapper
  if (isDragging) {
    return cardContent
  }

  // Normal render with sortable functionality
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab active:cursor-grabbing',
        isSortableDragging && 'opacity-0'
      )}
    >
      <Link href={`/customers/${customer.id}`} className="block">
        {cardContent}
      </Link>
    </div>
  )
}

interface KanbanColumnProps {
  stage: typeof SALES_STAGES[number]
  customers: Customer[]
}

function KanbanColumn({ stage, customers }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-w-[300px] w-[340px] flex-shrink-0 rounded-lg transition-all duration-150 p-4 bg-background",
        isOver && "bg-blue-50 ring-2 ring-blue-400"
      )}
    >
      {/* Column Header */}
      <div className="mb-3 sticky top-0 bg-background z-10 pb-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-sm flex-1 truncate">{stage.label}</h3>
          <Badge variant="secondary" className="text-xs flex-shrink-0">
            {customers.length}
          </Badge>
        </div>
        <div className={cn('h-1 rounded-full mt-2', stage.color.split(' ')[0])} />
      </div>

      {/* Customer Cards */}
      <SortableContext items={customers.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-2.5 overflow-y-auto min-h-[350px] max-h-[calc(100vh-300px)]">
          {customers.length === 0 ? (
            <div className="text-center py-20 text-sm text-muted-foreground border-2 border-dashed rounded-lg min-h-[300px] flex items-center justify-center">
              <div className="text-xs opacity-50">Drop customers here</div>
            </div>
          ) : (
            customers.map(customer => (
              <CustomerCard key={customer.id} customer={customer} />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  )
}

export function CustomerKanban() {
  const queryClient = useQueryClient()
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  )

  // Fetch all customers with enriched data
  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers-kanban'],
    queryFn: async () => {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('customers')
        .select(`
          id,
          display_name,
          email,
          sales_stage,
          created_at,
          updated_at
        `)
        .order('updated_at', { ascending: false })

      if (error) throw error

      // Enrich with project counts and last contact
      const enrichedCustomers = await Promise.all(
        (data || []).map(async (customer) => {
          // Get project count
          const { count: projectCount } = await supabase
            .from('work_items')
            .select('*', { count: 'exact', head: true })
            .eq('customer_id', customer.id)

          // Get last communication (wrapped in try-catch for backward compatibility)
          let lastComm = null
          try {
            const { data } = await supabase
              .from('communications')
              .select('created_at')
              .eq('customer_id', customer.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            lastComm = data
          } catch (error) {
            // customer_id column might not exist yet - that's okay
            console.debug('Could not fetch last communication:', error)
          }

          return {
            ...customer,
            project_count: projectCount || 0,
            last_contact: lastComm?.created_at,
          }
        })
      )

      return enrichedCustomers as Customer[]
    },
  })

  // Mutation to update customer stage
  const updateStageMutation = useMutation({
    mutationFn: async ({ customerId, newStage }: { customerId: string; newStage: SalesStage }) => {
      const supabase = createClient()

      const { error } = await supabase
        .from('customers')
        .update({ sales_stage: newStage, updated_at: new Date().toISOString() })
        .eq('id', customerId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers-kanban'] })
    },
  })

  // Group customers by stage
  const customersByStage = useMemo(() => {
    if (!customers) return {}

    return customers.reduce((acc, customer) => {
      const stage = customer.sales_stage || 'new_lead'
      if (!acc[stage]) acc[stage] = []
      acc[stage].push(customer)
      return acc
    }, {} as Record<string, Customer[]>)
  }, [customers])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) {
      setActiveId(null)
      return
    }

    const activeCustomer = customers?.find(c => c.id === active.id)
    if (!activeCustomer) {
      setActiveId(null)
      return
    }

    // Determine target stage: either directly dropped on column, or find column of dropped-on card
    let targetStageId: string | undefined = undefined

    // First check if dropped directly on a column
    const directStage = SALES_STAGES.find(s => s.id === over.id)
    if (directStage) {
      targetStageId = directStage.id
    } else {
      // Dropped on another card - find which column that card is in
      const overCustomer = customers?.find(c => c.id === over.id)
      if (overCustomer) {
        targetStageId = overCustomer.sales_stage
      }
    }

    // Update stage if different
    if (targetStageId && activeCustomer.sales_stage !== targetStageId) {
      updateStageMutation.mutate({
        customerId: activeCustomer.id,
        newStage: targetStageId as SalesStage,
      })
    }

    setActiveId(null)
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  const activeCustomer = customers?.find(c => c.id === activeId)

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="flex gap-4 overflow-x-auto">
            {SALES_STAGES.map(stage => (
              <div key={stage.id} className="min-w-[280px] space-y-2">
                <div className="h-24 bg-gray-200 rounded"></div>
                <div className="h-24 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Desktop: Horizontal Kanban */}
      <div className="hidden md:block w-full overflow-x-auto bg-muted/30 border-y">
        <div className="flex gap-6 px-4 sm:px-6 lg:px-8 py-6 min-h-[500px]">
            {SALES_STAGES.map(stage => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                customers={customersByStage[stage.id] || []}
              />
            ))}
        </div>
      </div>

      {/* Mobile: Vertical Stack */}
      <div className="md:hidden space-y-6 px-4 py-4">
        {SALES_STAGES.map(stage => {
          const stageCustomers = customersByStage[stage.id] || []
          if (stageCustomers.length === 0) return null

          return (
            <div key={stage.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{stage.label}</h3>
                <Badge variant="secondary" className="text-xs">
                  {stageCustomers.length}
                </Badge>
              </div>
              <div className={cn('h-1 rounded-full', stage.color.split(' ')[0])} />
              <SortableContext items={stageCustomers.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {stageCustomers.map(customer => (
                    <CustomerCard key={customer.id} customer={customer} />
                  ))}
                </div>
              </SortableContext>
            </div>
          )
        })}
      </div>

      {/* Drag Overlay */}
      <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
        {activeCustomer && (
          <div className="cursor-grabbing opacity-80" style={{ width: '320px' }}>
            <CustomerCard customer={activeCustomer} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
