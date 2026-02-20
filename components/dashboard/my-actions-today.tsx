'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import {
  Mail,
  CheckCircle2,
  FileText,
  AlertCircle,
  Clock,
  ArrowRight,
  Inbox,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

interface MyAction {
  id: string
  type: 'email' | 'approval' | 'review' | 'follow_up' | 'dlq'
  title: string
  subtitle?: string
  link: string
  priority: 'high' | 'medium' | 'low'
  dueInfo?: string
  icon: any
}

export function MyActionsToday() {
  const supabase = createClient()

  // Fetch actions for the current user
  const { data: actions, isLoading } = useQuery({
    queryKey: ['my-actions-today'],
    queryFn: async () => {
      const actions: MyAction[] = []

      // 1. Untriaged emails (high priority)
      const { data: untriagedEmails } = await supabase
        .from('communications')
        .select('id, subject, from_email, received_at')
        .eq('triage_status', 'untriaged')
        .eq('direction', 'inbound')
        .order('received_at', { ascending: false })
        .limit(5)

      untriagedEmails?.forEach((email) => {
        actions.push({
          id: email.id,
          type: 'email',
          title: email.subject || '(no subject)',
          subtitle: `From: ${email.from_email}`,
          link: `/email-intake?email=${email.id}`,
          priority: 'high',
          dueInfo: formatDistanceToNow(new Date(email.received_at), {
            addSuffix: true,
          }),
          icon: Mail,
        })
      })

      // 2. Follow-ups due today (high priority)
      const { data: followUpsToday } = await supabase
        .from('work_items')
        .select('id, title, customer_name, next_follow_up_at')
        .is('closed_at', null)
        .not('next_follow_up_at', 'is', null)
        .lte('next_follow_up_at', new Date().toISOString())
        .order('next_follow_up_at')
        .limit(5)

      followUpsToday?.forEach((item) => {
        actions.push({
          id: item.id,
          type: 'follow_up',
          title: item.title || 'Follow-up needed',
          subtitle: item.customer_name || 'Unknown customer',
          link: `/work-items/${item.id}`,
          priority: 'high',
          dueInfo: item.next_follow_up_at
            ? `Due ${formatDistanceToNow(new Date(item.next_follow_up_at), { addSuffix: true })}`
            : 'Overdue',
          icon: Clock,
        })
      })

      // 3. Designs awaiting approval (medium priority)
      const { data: awaitingApproval } = await supabase
        .from('work_items')
        .select('id, title, customer_name, updated_at')
        .eq('status', 'awaiting_approval')
        .is('closed_at', null)
        .order('updated_at')
        .limit(3)

      awaitingApproval?.forEach((item) => {
        actions.push({
          id: item.id,
          type: 'approval',
          title: item.title || 'Approval pending',
          subtitle: item.customer_name || 'Unknown customer',
          link: `/work-items/${item.id}`,
          priority: 'medium',
          dueInfo: formatDistanceToNow(new Date(item.updated_at), {
            addSuffix: true,
          }),
          icon: CheckCircle2,
        })
      })

      // 4. Design review queue (medium priority)
      const { data: designReview } = await supabase
        .from('work_items')
        .select('id, title, customer_name, updated_at')
        .eq('status', 'design_received')
        .eq('design_review_status', 'pending')
        .is('closed_at', null)
        .order('updated_at')
        .limit(3)

      designReview?.forEach((item) => {
        actions.push({
          id: item.id,
          type: 'review',
          title: item.title || 'Design review needed',
          subtitle: item.customer_name || 'Unknown customer',
          link: `/work-items/${item.id}`,
          priority: 'medium',
          dueInfo: formatDistanceToNow(new Date(item.updated_at), {
            addSuffix: true,
          }),
          icon: FileText,
        })
      })

      // 5. DLQ failures needing attention (high priority)
      const { data: dlqFailures } = await supabase
        .from('dead_letter_queue')
        .select('id, operation_type, operation_key, created_at')
        .eq('status', 'failed')
        .is('alerted_at', null)
        .order('created_at')
        .limit(3)

      dlqFailures?.forEach((item) => {
        actions.push({
          id: item.id,
          type: 'dlq',
          title: `Failed: ${item.operation_type}`,
          subtitle: item.operation_key,
          link: `/admin/dlq?id=${item.id}`,
          priority: 'high',
          dueInfo: formatDistanceToNow(new Date(item.created_at), {
            addSuffix: true,
          }),
          icon: AlertCircle,
        })
      })

      // Sort by priority (high > medium > low) and then by creation time
      return actions.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      })
    },
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            My Actions Today
          </CardTitle>
          <CardDescription>Loading your action items...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const highPriorityCount = actions?.filter((a) => a.priority === 'high').length || 0
  const totalActions = actions?.length || 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              My Actions Today
            </CardTitle>
            <CardDescription>
              {totalActions === 0
                ? 'All caught up! 🎉'
                : `${totalActions} items need your attention`}
            </CardDescription>
          </div>
          {highPriorityCount > 0 && (
            <Badge variant="destructive" className="text-sm">
              {highPriorityCount} urgent
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {totalActions === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="mb-2 text-4xl">✨</div>
            <p>No actions needed right now</p>
            <p className="text-sm mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {actions?.slice(0, 10).map((action) => {
              const Icon = action.icon
              return (
                <Link key={`${action.type}-${action.id}`} href={action.link}>
                  <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group cursor-pointer">
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        action.priority === 'high'
                          ? 'bg-[#E91E63]/10'
                          : action.priority === 'medium'
                          ? 'bg-[#FFC107]/10'
                          : 'bg-[#00BCD4]/10'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 ${
                          action.priority === 'high'
                            ? 'text-[#E91E63]'
                            : action.priority === 'medium'
                            ? 'text-[#FFC107]'
                            : 'text-[#00BCD4]'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-1">
                            {action.title}
                          </p>
                          {action.subtitle && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {action.subtitle}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                      {action.dueInfo && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {action.dueInfo}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
            {totalActions > 10 && (
              <div className="text-center pt-2">
                <p className="text-sm text-muted-foreground">
                  + {totalActions - 10} more actions
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
