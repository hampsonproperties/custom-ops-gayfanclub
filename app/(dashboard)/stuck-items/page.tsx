'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  useStuckItems,
  useStuckItemsSummary,
  type StuckItem,
} from '@/lib/hooks/use-stuck-items'
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  FileX,
  Mail,
  DollarSign,
  ClipboardX,
  XCircle,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

const STUCK_REASON_CONFIG = {
  expired_approval: {
    label: 'Expired Approval',
    icon: Clock,
    color: 'text-[#E91E63]',
    bgColor: 'bg-[#E91E63]/10',
    badgeVariant: 'destructive' as const,
    description: 'Approval link sent >14 days ago, likely expired',
  },
  overdue_invoice: {
    label: 'Overdue Invoice',
    icon: DollarSign,
    color: 'text-[#FF9800]',
    bgColor: 'bg-[#FF9800]/10',
    badgeVariant: 'default' as const,
    description: 'Deposit paid but balance overdue >30 days',
  },
  awaiting_files: {
    label: 'Awaiting Files',
    icon: FileX,
    color: 'text-[#FFC107]',
    bgColor: 'bg-[#FFC107]/10',
    badgeVariant: 'default' as const,
    description: 'Waiting for customer files >7 days',
  },
  design_review_pending: {
    label: 'Design Review Pending',
    icon: ClipboardX,
    color: 'text-[#9C27B0]',
    bgColor: 'bg-[#9C27B0]/10',
    badgeVariant: 'secondary' as const,
    description: 'Design received but not reviewed >7 days',
  },
  no_follow_up_scheduled: {
    label: 'No Follow-Up',
    icon: AlertTriangle,
    color: 'text-[#607D8B]',
    bgColor: 'bg-[#607D8B]/10',
    badgeVariant: 'outline' as const,
    description: 'Open item without follow-up scheduled',
  },
  stale_no_activity: {
    label: 'Stale / No Activity',
    icon: AlertCircle,
    color: 'text-[#9E9E9E]',
    bgColor: 'bg-[#9E9E9E]/10',
    badgeVariant: 'outline' as const,
    description: 'No updates or communication >14 days',
  },
  dlq_max_retries: {
    label: 'Failed Operation',
    icon: XCircle,
    color: 'text-[#F44336]',
    bgColor: 'bg-[#F44336]/10',
    badgeVariant: 'destructive' as const,
    description: 'Operation failed max retries, needs manual fix',
  },
}

function StuckItemCard({ item }: { item: StuckItem }) {
  const config = STUCK_REASON_CONFIG[item.stuck_reason as keyof typeof STUCK_REASON_CONFIG]
  const Icon = config.icon

  return (
    <Link
      href={
        item.dlq_id
          ? `/admin/dlq?id=${item.dlq_id}`
          : `/work-items/${item.work_item_id}`
      }
    >
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className={`p-1.5 rounded-lg ${config.bgColor}`}>
                  <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                </div>
                <Badge variant={config.badgeVariant}>{config.label}</Badge>
                {item.priority_score === 3 && (
                  <Badge variant="destructive" className="text-xs">
                    HIGH
                  </Badge>
                )}
              </div>
              <CardTitle className="text-lg line-clamp-2">
                {item.title || item.item_type || 'Untitled Item'}
              </CardTitle>
              <CardDescription className="mt-1">
                {item.customer_name || item.customer_email || 'No customer'}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-muted-foreground">
                {item.days_stuck}
              </div>
              <div className="text-xs text-muted-foreground">days stuck</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="capitalize">{item.status.replace(/_/g, ' ')}</span>
              {item.last_contact_at && (
                <span>
                  Last contact{' '}
                  {formatDistanceToNow(new Date(item.last_contact_at), {
                    addSuffix: true,
                  })}
                </span>
              )}
            </div>
            <ExternalLink className="h-3.5 w-3.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function SummaryCard({
  title,
  count,
  icon: Icon,
  color,
  bgColor,
  description,
}: {
  title: string
  count: number
  icon: any
  color: string
  bgColor: string
  description: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <div className={`p-2 rounded-lg ${bgColor}`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{count}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  )
}

export default function StuckItemsPage() {
  const { data: stuckItems, isLoading } = useStuckItems()
  const { data: summary } = useStuckItemsSummary()

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Stuck Items</h1>
        <p className="text-muted-foreground">
          Items that need attention to keep operations moving
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            title="Expired Approvals"
            count={summary.expired_approvals_count}
            icon={Clock}
            color="text-[#E91E63]"
            bgColor="bg-[#E91E63]/10"
            description="Approval links >14 days old"
          />
          <SummaryCard
            title="Overdue Invoices"
            count={summary.overdue_invoices_count}
            icon={DollarSign}
            color="text-[#FF9800]"
            bgColor="bg-[#FF9800]/10"
            description="Balance unpaid >30 days"
          />
          <SummaryCard
            title="Awaiting Files"
            count={summary.awaiting_files_count}
            icon={FileX}
            color="text-[#FFC107]"
            bgColor="bg-[#FFC107]/10"
            description="No files received >7 days"
          />
          <SummaryCard
            title="Failed Operations"
            count={summary.dlq_failures_count}
            icon={XCircle}
            color="text-[#F44336]"
            bgColor="bg-[#F44336]/10"
            description="DLQ items needing manual fix"
          />
        </div>
      )}

      {/* Total Count Banner */}
      {summary && summary.total_stuck_items > 0 && (
        <Card className="border-l-4 border-l-[#E91E63]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">
                  {summary.total_stuck_items} Total Stuck Items
                </CardTitle>
                <CardDescription className="mt-1">
                  These items need operator attention to move forward
                </CardDescription>
              </div>
              <AlertCircle className="h-8 w-8 text-[#E91E63]" />
            </div>
          </CardHeader>
        </Card>
      )}

      {/* No Stuck Items */}
      {(!stuckItems || stuckItems.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="p-4 rounded-full bg-green-100 mb-4">
              <ClipboardX className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">All Clear! 🎉</h3>
            <p className="text-muted-foreground text-center max-w-md">
              No stuck items detected. All operations are flowing smoothly.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stuck Items List */}
      {stuckItems && stuckItems.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">All Stuck Items</h2>
            <p className="text-sm text-muted-foreground">
              Sorted by priority and age
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {stuckItems.map((item) => (
              <StuckItemCard
                key={item.work_item_id || item.dlq_id}
                item={item}
              />
            ))}
          </div>
        </div>
      )}

      {/* Help Card */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-lg">What are stuck items?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Stuck items are work items or operations that haven't progressed in an
            unusually long time. They may indicate:
          </p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
            <li>Expired approval links that need to be resent</li>
            <li>Invoices where payment hasn't been received</li>
            <li>Files that customers haven't uploaded yet</li>
            <li>Technical failures that need manual intervention</li>
            <li>Items that fell through the cracks</li>
          </ul>
          <p className="mt-4">
            Review these items regularly to keep your operations flowing smoothly.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
