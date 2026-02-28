'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
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
  } = useSortable({ id: customer.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  }

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return (email || 'U').charAt(0).toUpperCase()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50'
      )}
    >
      <Link href={`/customers/${customer.id}`}>
        <Card className="p-3 hover:shadow-md transition-shadow bg-white border border-gray-200">
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
      </Link>
    </div>
  )
}

interface KanbanColumnProps {
  stage: typeof SALES_STAGES[number]
  customers: Customer[]
}

function KanbanColumn({ stage, customers }: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-w-[280px] w-[320px] flex-shrink-0">
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
        <div className="flex-1 space-y-2.5 overflow-y-auto min-h-[300px] max-h-[calc(100vh-300px)] pr-1">
          {customers.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <div className="text-xs opacity-50">No customers</div>
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
        distance: 8,
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
              .single()

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

    // Check if dropped on a different column
    const activeCustomer = customers?.find(c => c.id === active.id)
    const overContainer = over.id as string

    // If over is a stage ID, update the customer's stage
    const targetStage = SALES_STAGES.find(s => s.id === overContainer)

    if (activeCustomer && targetStage && activeCustomer.sales_stage !== targetStage.id) {
      updateStageMutation.mutate({
        customerId: activeCustomer.id,
        newStage: targetStage.id,
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
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Desktop: Horizontal Kanban */}
      <div className="hidden md:block w-full overflow-x-auto bg-muted/30 border-y">
        <div className="flex gap-4 px-4 sm:px-6 lg:px-8 py-6 min-h-[500px]">
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
      <DragOverlay>
        {activeCustomer && <CustomerCard customer={activeCustomer} isDragging />}
      </DragOverlay>
    </DndContext>
  )
}
