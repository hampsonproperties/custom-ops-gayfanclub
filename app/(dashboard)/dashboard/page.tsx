'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  useOrganizedSalesPipeline,
  useOrganizedProductionPipeline,
} from '@/lib/hooks/use-pipelines'
import { useUntriagedEmails } from '@/lib/hooks/use-communications'
import {
  AlertCircle,
  Mail,
  DollarSign,
  MessageSquare,
  Clock,
  Package,
  Palette,
  CheckCircle,
  Truck,
  Calendar,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

export default function DashboardPage() {
  const { data: sales, isLoading: salesLoading } = useOrganizedSalesPipeline()
  const { data: production, isLoading: productionLoading } = useOrganizedProductionPipeline()
  const { data: untriagedResult } = useUntriagedEmails()
  const untriagedEmails = untriagedResult?.items

  const formatCurrency = (value: number | null) => {
    if (!value) return ''
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Command Center</h1>
        <p className="text-muted-foreground">Sales & Production at a glance</p>
      </div>

      {/* Inbox Badge (if there are untriaged emails) */}
      {untriagedEmails && untriagedEmails.length > 0 && (
        <Link href="/inbox">
          <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {untriagedEmails.length} New Email{untriagedEmails.length > 1 ? 's' : ''} Need Triage
              </CardTitle>
              <Button variant="outline" size="sm">View Inbox</Button>
            </CardHeader>
          </Card>
        </Link>
      )}

      {/* Split View: Sales + Production */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SALES PIPELINE */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Sales Pipeline
            </h2>
            <Link href="/follow-ups">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>

          {/* Overdue */}
          {sales?.overdue && sales.overdue.length > 0 && (
            <Card className="border-l-4 border-l-red-500">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  Overdue ({sales.overdue.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sales.overdue.slice(0, 3).map((lead) => (
                  <Link key={lead.id} href={`/work-items/${lead.id}`}>
                    <div className="p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
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
                    <div className="text-sm text-center text-muted-foreground hover:text-foreground py-2">
                      +{sales.overdue.length - 3} more overdue
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {/* New Inquiries */}
          {sales?.newInquiries && sales.newInquiries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  New Inquiries ({sales.newInquiries.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sales.newInquiries.slice(0, 5).map((lead) => (
                  <Link key={lead.id} href={`/work-items/${lead.id}`}>
                    <div className="p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
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
                    <div className="text-sm text-center text-muted-foreground hover:text-foreground py-2">
                      +{sales.newInquiries.length - 5} more inquiries
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {/* High Value */}
          {sales?.highValue && sales.highValue.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  High Value ({sales.highValue.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sales.highValue.slice(0, 3).map((lead) => (
                  <Link key={lead.id} href={`/work-items/${lead.id}`}>
                    <div className="p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{lead.customer_name}</div>
                          <div className="text-sm text-muted-foreground">
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
        <div className="space-y-4">
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
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Needs Design Review ({production.needsReview.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {production.needsReview.slice(0, 4).map((project) => (
                  <Link key={project.id} href={`/work-items/${project.id}`}>
                    <div className="p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors">
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
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Ready for Batch ({production.readyForBatch.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link href="/batches">
                  <Button variant="outline" className="w-full" size="sm">
                    Create New Batch
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* In Progress */}
          {production?.inProgress && production.inProgress.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  In Production ({production.inProgress.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  {production.inProgress.length} projects currently being produced
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recently Shipped */}
          {production?.recentlyShipped && production.recentlyShipped.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Truck className="h-4 w-4 text-green-600" />
                  Recently Shipped
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {production.recentlyShipped.map((project) => (
                  <Link key={project.id} href={`/work-items/${project.id}`}>
                    <div className="p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors">
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
