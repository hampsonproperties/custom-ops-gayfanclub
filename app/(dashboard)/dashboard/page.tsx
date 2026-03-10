'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  useOrganizedSalesPipeline,
  useOrganizedProductionPipeline,
} from '@/lib/hooks/use-pipelines'
import { useUntriagedEmails } from '@/lib/hooks/use-communications'
import { useMyTasks, useToggleTask, type Task } from '@/lib/hooks/use-tasks'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  AlertCircle,
  Mail,
  DollarSign,
  MessageSquare,
  Package,
  Palette,
  CheckCircle,
  Truck,
  Calendar,
  ListTodo,
  Circle,
  Clock,
  ArrowRight,
  Inbox,
  Send,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

// Hook: fetch customers needing my reply (last_inbound_at > last_outbound_at)
function useNeedsMyReply() {
  return useQuery({
    queryKey: ['morning-briefing', 'needs-my-reply'],
    queryFn: async () => {
      const supabase = createClient()
      // Customers who sent the last email and we haven't replied
      const { data, error } = await supabase
        .from('customers')
        .select('id, email, first_name, last_name, display_name, organization_name, customer_type, last_inbound_at, last_outbound_at')
        .not('last_inbound_at', 'is', null)
        .or('last_outbound_at.is.null,last_inbound_at.gt.last_outbound_at')
        .order('last_inbound_at', { ascending: true }) // oldest unanswered first
        .limit(10)

      if (error) throw error
      return data || []
    },
    refetchInterval: 5 * 60 * 1000,
  })
}

// Hook: fetch customers waiting on response (last_outbound_at > last_inbound_at, 2+ days)
function useWaitingOnCustomer() {
  return useQuery({
    queryKey: ['morning-briefing', 'waiting-on-customer'],
    queryFn: async () => {
      const supabase = createClient()
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      // Customers we emailed but who haven't replied, where our last email was 2+ days ago
      const { data, error } = await supabase
        .from('customers')
        .select('id, email, first_name, last_name, display_name, organization_name, customer_type, last_inbound_at, last_outbound_at')
        .not('last_outbound_at', 'is', null)
        .lt('last_outbound_at', twoDaysAgo)
        .or('last_inbound_at.is.null,last_outbound_at.gt.last_inbound_at')
        .order('last_outbound_at', { ascending: true }) // longest wait first
        .limit(10)

      if (error) throw error
      return data || []
    },
    refetchInterval: 5 * 60 * 1000,
  })
}

// Hook: fetch overdue and due-today follow-ups
function useFollowUpsBriefing() {
  return useQuery({
    queryKey: ['morning-briefing', 'follow-ups'],
    queryFn: async () => {
      const supabase = createClient()
      const now = new Date()
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

      const { data, error } = await supabase
        .from('work_items')
        .select('id, title, status, customer_name, customer_email, next_follow_up_at, event_date, estimated_value')
        .is('closed_at', null)
        .not('next_follow_up_at', 'is', null)
        .lte('next_follow_up_at', endOfToday)
        .order('next_follow_up_at', { ascending: true })
        .limit(10)

      if (error) throw error
      return data || []
    },
    refetchInterval: 5 * 60 * 1000,
  })
}

function getCustomerDisplayName(c: any): string {
  return c.display_name ||
    (c.organization_name && (c.customer_type === 'retailer' || c.customer_type === 'organization') ? c.organization_name : null) ||
    [c.first_name, c.last_name].filter(Boolean).join(' ') ||
    c.email || 'Unknown'
}

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

export default function DashboardPage() {
  const { data: sales, isLoading: salesLoading } = useOrganizedSalesPipeline()
  const { data: production, isLoading: productionLoading } = useOrganizedProductionPipeline()
  const { data: untriagedResult } = useUntriagedEmails()
  const untriagedEmails = untriagedResult?.items
  const { data: myTasks } = useMyTasks()
  const toggleTask = useToggleTask()

  const { data: needsReply } = useNeedsMyReply()
  const { data: waitingOn } = useWaitingOnCustomer()
  const { data: followUps } = useFollowUpsBriefing()

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return ''
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (date: string | null) => {
    if (!date) return ''
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  }

  if (salesLoading || productionLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    )
  }

  const hasMorningItems = (needsReply && needsReply.length > 0) ||
    (waitingOn && waitingOn.length > 0) ||
    (followUps && followUps.length > 0)

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Morning Briefing</h1>
        <p className="text-muted-foreground">Who needs attention today</p>
      </div>

      {/* Inbox Alert Strip */}
      {untriagedEmails && untriagedEmails.length > 0 && (
        <Link href="/inbox" className="block">
          <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 hover:bg-blue-100/80 transition-colors cursor-pointer">
            <div className="text-sm font-medium flex items-center gap-2 text-blue-700">
              <Mail className="h-4 w-4" />
              {untriagedEmails.length} New Email{untriagedEmails.length > 1 ? 's' : ''} Need Triage
            </div>
            <span className="text-sm font-medium text-blue-600">View Inbox &rarr;</span>
          </div>
        </Link>
      )}

      {/* ===================== MORNING BRIEFING ===================== */}

      {/* Needs My Reply */}
      {needsReply && needsReply.length > 0 && (
        <Card className="border-l-2 border-l-amber-400">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700">
              <Inbox className="h-4 w-4" />
              Needs My Reply ({needsReply.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            {needsReply.map((c) => {
              const days = daysAgo(c.last_inbound_at!)
              return (
                <Link key={c.id} href={`/customers/${c.id}`}>
                  <div className="p-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{getCustomerDisplayName(c)}</div>
                      <div className="text-sm text-muted-foreground truncate">{c.email}</div>
                    </div>
                    <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs gap-1 ml-2 shrink-0">
                      <Clock className="h-3 w-3" />
                      {days === 0 ? 'Today' : `${days}d ago`}
                    </Badge>
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Waiting on Customer */}
      {waitingOn && waitingOn.length > 0 && (
        <Card className="border-l-2 border-l-slate-300">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
              <Send className="h-4 w-4" />
              Waiting on Customer ({waitingOn.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            {waitingOn.map((c) => {
              const days = daysAgo(c.last_outbound_at!)
              return (
                <Link key={c.id} href={`/customers/${c.id}`}>
                  <div className="p-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{getCustomerDisplayName(c)}</div>
                      <div className="text-sm text-muted-foreground truncate">{c.email}</div>
                    </div>
                    <Badge variant="outline" className="text-muted-foreground border-muted text-xs gap-1 ml-2 shrink-0">
                      <Clock className="h-3 w-3" />
                      {days}d waiting
                    </Badge>
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Follow-Ups Due */}
      {followUps && followUps.length > 0 && (
        <Card className="border-l-2 border-l-red-400">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                Follow-Ups Due ({followUps.length})
              </CardTitle>
              <Link href="/follow-ups">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                  View All <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            {followUps.slice(0, 5).map((item) => {
              const isOverdue = item.next_follow_up_at && new Date(item.next_follow_up_at) < new Date()
              return (
                <Link key={item.id} href={`/work-items/${item.id}`}>
                  <div className="p-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{item.customer_name || item.customer_email}</div>
                      <div className="text-sm text-muted-foreground truncate">{item.title}</div>
                    </div>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      {item.estimated_value && (
                        <Badge variant="outline" className="text-xs">
                          {formatCurrency(item.estimated_value)}
                        </Badge>
                      )}
                      <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        {formatDate(item.next_follow_up_at)}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
            {followUps.length > 5 && (
              <Link href="/follow-ups">
                <div className="text-sm text-center font-medium text-red-600/70 hover:text-red-600 py-2 hover:underline">
                  +{followUps.length - 5} more follow-ups &rarr;
                </div>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* All clear state */}
      {!hasMorningItems && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <div className="font-medium">You're all caught up!</div>
            <div className="text-sm">No replies needed, no follow-ups due today</div>
          </CardContent>
        </Card>
      )}

      {/* My Tasks */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              My Tasks {myTasks && myTasks.length > 0 ? `(${myTasks.length})` : ''}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-1">
          {!myTasks || myTasks.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No tasks assigned to you right now
            </div>
          ) : (
            myTasks.map((task) => {
              const isOverdue = task.due_date && new Date(task.due_date) < new Date()
              return (
                <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
                  <button
                    type="button"
                    onClick={() => toggleTask.mutate({ taskId: task.id, completed: true })}
                    className="shrink-0 text-muted-foreground hover:text-primary"
                  >
                    <Circle className="h-4 w-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{task.title}</div>
                    {task.due_date && (
                      <div className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        Due {formatDate(task.due_date)}
                      </div>
                    )}
                  </div>
                  {task.work_item_id && (
                    <Link href={`/work-items/${task.work_item_id}`} className="text-xs text-primary hover:underline shrink-0">
                      View
                    </Link>
                  )}
                  {!task.work_item_id && task.customer_id && (
                    <Link href={`/customers/${task.customer_id}`} className="text-xs text-primary hover:underline shrink-0">
                      View
                    </Link>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Split View: Sales + Production */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SALES PIPELINE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Sales Pipeline
            </h2>
            <Link href="/sales-leads">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>

          {/* Overdue */}
          {sales?.overdue && sales.overdue.length > 0 && (
            <Card className="border-l-2 border-l-red-400">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  Overdue ({sales.overdue.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                {sales.overdue.slice(0, 3).map((lead) => (
                  <Link key={lead.id} href={`/work-items/${lead.id}`}>
                    <div className="p-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{lead.customer_name}</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {lead.title}
                          </div>
                          <div className="flex gap-2 mt-1">
                            {lead.estimated_value && (
                              <Badge variant="outline" className="text-xs">
                                {formatCurrency(lead.estimated_value)}
                              </Badge>
                            )}
                            {lead.tag_names && lead.tag_names.length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {lead.tag_names[0]}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-red-600">
                          {formatDate(lead.next_follow_up_at)}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
                {sales.overdue.length > 3 && (
                  <Link href="/follow-ups">
                    <div className="text-sm text-center font-medium text-red-600/70 hover:text-red-600 py-2 hover:underline">
                      +{sales.overdue.length - 3} more overdue &rarr;
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {/* New Inquiries */}
          {sales?.newInquiries && sales.newInquiries.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  New Inquiries ({sales.newInquiries.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                {sales.newInquiries.slice(0, 5).map((lead) => (
                  <Link key={lead.id} href={`/work-items/${lead.id}`}>
                    <div className="p-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{lead.customer_name}</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {lead.title}
                          </div>
                          <div className="flex gap-2 mt-1">
                            {lead.estimated_value && (
                              <Badge variant="outline" className="text-xs">
                                {formatCurrency(lead.estimated_value)}
                              </Badge>
                            )}
                            {lead.email_count > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                <Mail className="h-3 w-3 mr-1" />
                                {lead.email_count}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(lead.created_at)}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
                {sales.newInquiries.length > 5 && (
                  <Link href="/follow-ups">
                    <div className="text-sm text-center font-medium text-muted-foreground hover:text-foreground py-2 hover:underline">
                      +{sales.newInquiries.length - 5} more inquiries &rarr;
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {/* High Value */}
          {sales?.highValue && sales.highValue.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  High Value ({sales.highValue.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                {sales.highValue.slice(0, 3).map((lead) => (
                  <Link key={lead.id} href={`/work-items/${lead.id}`}>
                    <div className="p-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{lead.customer_name}</div>
                          <div className="text-sm text-muted-foreground capitalize">
                            {lead.status.replace(/_/g, ' ')}
                          </div>
                          <Badge variant="default" className="text-xs mt-1 bg-green-600">
                            {formatCurrency(lead.estimated_value!)}
                          </Badge>
                        </div>
                        {lead.event_date && (
                          <div className="text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3 inline mr-1" />
                            {new Date(lead.event_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {(!sales?.overdue || sales.overdue.length === 0) &&
           (!sales?.newInquiries || sales.newInquiries.length === 0) &&
           (!sales?.highValue || sales.highValue.length === 0) && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <div>No active sales leads</div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* PRODUCTION PIPELINE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Package className="h-5 w-5" />
              Production Pipeline
            </h2>
            <Link href="/work-items">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>

          {/* Needs Design Review */}
          {production?.needsReview && production.needsReview.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Palette className="h-4 w-4 text-amber-600" />
                  Needs Design Review ({production.needsReview.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                {production.needsReview.slice(0, 4).map((project) => (
                  <Link key={project.id} href={`/work-items/${project.id}`}>
                    <div className="p-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                      <div className="font-medium">{project.customer_name}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {project.title}
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Ready for Batch */}
          {production?.readyForBatch && production.readyForBatch.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-600" />
                  Ready for Batch ({production.readyForBatch.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {production.readyForBatch.length} item{production.readyForBatch.length !== 1 ? 's' : ''} awaiting batch
                  </div>
                  <Link href="/batches">
                    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 px-3">
                      Create Batch &rarr;
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* In Progress */}
          {production?.inProgress && production.inProgress.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-purple-600" />
                  In Production ({production.inProgress.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="text-sm text-muted-foreground">
                  {production.inProgress.length} project{production.inProgress.length !== 1 ? 's' : ''} currently being produced
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recently Shipped */}
          {production?.recentlyShipped && production.recentlyShipped.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Truck className="h-4 w-4 text-green-600" />
                  Recently Shipped ({production.recentlyShipped.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                {production.recentlyShipped.map((project) => (
                  <Link key={project.id} href={`/work-items/${project.id}`}>
                    <div className="p-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                      <div className="font-medium">{project.customer_name}</div>
                      <div className="text-sm text-green-600">Shipped</div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {(!production?.needsReview || production.needsReview.length === 0) &&
           (!production?.readyForBatch || production.readyForBatch.length === 0) &&
           (!production?.inProgress || production.inProgress.length === 0) && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <div>No active production</div>
                <div className="text-sm">Nothing in the pipeline right now</div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
