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
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

export default function DashboardPage() {
  const { data: sales, isLoading: salesLoading } = useOrganizedSalesPipeline()
  const { data: production, isLoading: productionLoading } = useOrganizedProductionPipeline()
  const { data: untriagedResult } = useUntriagedEmails()
  const untriagedEmails = untriagedResult?.items
  const { data: myTasks } = useMyTasks()
  const toggleTask = useToggleTask()

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

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Command Center</h1>
        <p className="text-muted-foreground">Sales & Production at a glance</p>
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

      {/* My Tasks */}
      {myTasks && myTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ListTodo className="h-4 w-4" />
                My Tasks ({myTasks.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            {myTasks.map((task) => {
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
            })}
          </CardContent>
        </Card>
      )}

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
                <div className="text-sm">You're all caught up! 🎉</div>
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
                      <div className="text-sm text-green-600">✓ Shipped</div>
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
