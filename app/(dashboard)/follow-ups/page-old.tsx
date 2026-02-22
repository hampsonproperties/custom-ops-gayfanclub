'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { FollowUpItemCard } from '@/components/work-items/follow-up-item-card'
import {
  useWorkItems,
  useOverdueFollowUps,
  useFollowUpToday,
  useDueThisWeek,
  useNeedsInitialContact,
  useRushOrders,
  useWaitingOnCustomer,
} from '@/lib/hooks/use-work-items'
import {
  AlertCircle,
  Bell,
  Calendar,
  ChevronDown,
  Clock,
  Pause,
  UserPlus,
  Zap,
  CheckCircle2,
} from 'lucide-react'
import { useState } from 'react'

type WorkItem = any // Use proper type from database

export default function FollowUpsPage() {
  // Fetch all follow-up queues
  const { data: overdueItems = [] } = useOverdueFollowUps()
  const { data: todayItems = [] } = useFollowUpToday()
  const { data: weekItems = [] } = useDueThisWeek()
  const { data: needsContactItems = [] } = useNeedsInitialContact()
  const { data: rushItems = [] } = useRushOrders()
  const { data: waitingItems = [] } = useWaitingOnCustomer()
  const { data: allItems = [] } = useWorkItems()

  // Section collapse states
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({
    urgent: true,
    needsContact: true,
    dueToday: true,
    rush: true,
    dueWeek: false,
    waiting: false,
  })

  const toggleSection = (key: string) => {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Categorize urgent items (overdue + awaiting payment/fees) - SALES ONLY
  const urgentItems = useMemo(() => {
    const urgent = [...overdueItems]
    const urgentSalesStatuses = ['invoice_sent', 'design_fee_sent', 'awaiting_payment']

    allItems.forEach((item: WorkItem) => {
      if (urgentSalesStatuses.includes(item.status) && !item.closed_at && !item.is_waiting) {
        // Don't duplicate if already in overdue
        if (!urgent.find(u => u.id === item.id)) {
          urgent.push(item)
        }
      }
    })

    return urgent
  }, [overdueItems, allItems])

  // Filter out duplicates - priority order: urgent > needsContact > dueToday > rush > dueWeek
  const urgentIds = new Set(urgentItems.map(i => i.id))

  const filteredNeedsContact = needsContactItems.filter(
    (item: WorkItem) => !urgentIds.has(item.id)
  )
  const needsContactIds = new Set(filteredNeedsContact.map(i => i.id))

  const filteredTodayItems = todayItems.filter(
    (item: WorkItem) => !urgentIds.has(item.id) && !needsContactIds.has(item.id)
  )
  const todayIds = new Set(filteredTodayItems.map(i => i.id))

  const filteredRushItems = rushItems.filter(
    (item: WorkItem) => !urgentIds.has(item.id) && !needsContactIds.has(item.id) && !todayIds.has(item.id)
  )
  const rushIds = new Set(filteredRushItems.map(i => i.id))

  const filteredWeekItems = weekItems.filter(
    (item: WorkItem) =>
      !urgentIds.has(item.id) &&
      !needsContactIds.has(item.id) &&
      !todayIds.has(item.id) &&
      !rushIds.has(item.id)
  )

  const totalCount =
    urgentItems.length +
    filteredNeedsContact.length +
    filteredTodayItems.length +
    filteredRushItems.length +
    filteredWeekItems.length +
    waitingItems.length

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
          {totalCount} total
        </Badge>
      </div>

      {/* Empty State */}
      {totalCount === 0 && (
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

      {/* Sections */}
      <div className="space-y-4">
        {/* URGENT - Overdue & Blocking */}
        {urgentItems.length > 0 && (
          <Collapsible
            open={sectionsOpen.urgent}
            onOpenChange={() => toggleSection('urgent')}
          >
            <Card className="border-destructive/50">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <CardTitle className="text-destructive">
                        🔴 URGENT - Overdue & Blocking
                      </CardTitle>
                      <Badge variant="destructive">{urgentItems.length}</Badge>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${
                        sectionsOpen.urgent ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-3 pt-0">
                  {urgentItems.map((item: WorkItem) => (
                    <FollowUpItemCard key={item.id} workItem={item} />
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* NEEDS INITIAL CONTACT - Shopify-first orders */}
        {filteredNeedsContact.length > 0 && (
          <Collapsible
            open={sectionsOpen.needsContact}
            onOpenChange={() => toggleSection('needsContact')}
          >
            <Card className="border-purple-500/50">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5 text-purple-600" />
                      <CardTitle className="text-purple-600">
                        🆕 NEEDS INITIAL CONTACT
                      </CardTitle>
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                        {filteredNeedsContact.length}
                      </Badge>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${
                        sectionsOpen.needsContact ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-3 pt-0">
                  {filteredNeedsContact.map((item: WorkItem) => (
                    <FollowUpItemCard key={item.id} workItem={item} />
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* DUE TODAY */}
        {filteredTodayItems.length > 0 && (
          <Collapsible
            open={sectionsOpen.dueToday}
            onOpenChange={() => toggleSection('dueToday')}
          >
            <Card className="border-yellow-500/50">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="h-5 w-5 text-yellow-600" />
                      <CardTitle className="text-yellow-600">
                        🟡 DUE TODAY
                      </CardTitle>
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                        {filteredTodayItems.length}
                      </Badge>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${
                        sectionsOpen.dueToday ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-3 pt-0">
                  {filteredTodayItems.map((item: WorkItem) => (
                    <FollowUpItemCard key={item.id} workItem={item} />
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* RUSH / TOO LATE - Event <30 days */}
        {filteredRushItems.length > 0 && (
          <Collapsible
            open={sectionsOpen.rush}
            onOpenChange={() => toggleSection('rush')}
          >
            <Card className="border-orange-500/50">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-orange-600" />
                      <CardTitle className="text-orange-600">
                        ⚠️ RUSH / TOO LATE
                      </CardTitle>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                        {filteredRushItems.length}
                      </Badge>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${
                        sectionsOpen.rush ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-3 pt-0">
                  {filteredRushItems.map((item: WorkItem) => (
                    <FollowUpItemCard key={item.id} workItem={item} />
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* DUE THIS WEEK */}
        {filteredWeekItems.length > 0 && (
          <Collapsible
            open={sectionsOpen.dueWeek}
            onOpenChange={() => toggleSection('dueWeek')}
          >
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      <CardTitle>📅 DUE THIS WEEK</CardTitle>
                      <Badge variant="secondary">{filteredWeekItems.length}</Badge>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${
                        sectionsOpen.dueWeek ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-3 pt-0">
                  {filteredWeekItems.map((item: WorkItem) => (
                    <FollowUpItemCard key={item.id} workItem={item} />
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* WAITING ON CUSTOMER */}
        {waitingItems.length > 0 && (
          <Collapsible
            open={sectionsOpen.waiting}
            onOpenChange={() => toggleSection('waiting')}
          >
            <Card className="border-muted">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Pause className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-muted-foreground">
                        ⏸️ WAITING ON CUSTOMER
                      </CardTitle>
                      <Badge variant="outline">{waitingItems.length}</Badge>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${
                        sectionsOpen.waiting ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-3 pt-0">
                  {waitingItems.map((item: WorkItem) => (
                    <FollowUpItemCard key={item.id} workItem={item} />
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}
      </div>
    </div>
  )
}
