'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/custom/status-badge'
import { useInboxReplies, useMarkCommunicationActioned } from '@/lib/hooks/use-work-items'
import { InlineEmailComposer } from '@/components/email/inline-email-composer'
import { toast } from 'sonner'
import {
  Mail,
  ExternalLink,
  Check,
  Inbox,
  Clock,
  User,
  Reply,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import DOMPurify from 'dompurify'
import { parseEmailAddress, extractEmailPreview } from '@/lib/utils/email-formatting'

export default function InboxRepliesPage() {
  const { data: replies, isLoading } = useInboxReplies()
  const markActioned = useMarkCommunicationActioned()
  const [replyingToId, setReplyingToId] = useState<string | null>(null)

  const handleMarkActioned = async (communicationId: string) => {
    try {
      await markActioned.mutateAsync(communicationId)
      toast.success('Marked as actioned')
    } catch (error) {
      console.error('Mark actioned error:', error)
      toast.error('Failed to mark as actioned')
    }
  }

  const handleReplySuccess = () => {
    setReplyingToId(null)
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading inbox replies...</div>
        </div>
      </div>
    )
  }

  const unactionedReplies = replies || []

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inbox Replies</h1>
          <p className="text-muted-foreground mt-2">
            Customer responses to existing work items that need your attention
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {unactionedReplies.length} unactioned
        </Badge>
      </div>

      {/* Empty State */}
      {unactionedReplies.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Inbox className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
            <p className="text-muted-foreground text-center max-w-md">
              No customer replies need your attention right now. When customers respond
              to existing work items, they'll appear here.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Replies List */}
      <div className="space-y-4">
        {unactionedReplies.map((reply: any) => {
          const workItem = reply.work_item
          const receivedAt = reply.received_at ? new Date(reply.received_at) : null

          // Parse sender for cleaner display
          const sender = parseEmailAddress(reply.from_email || '')
          const cleanPreview = extractEmailPreview(reply.body_html, reply.body_preview, 200)

          return (
            <Card key={reply.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      {/* From Email & Time */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{sender.displayName}</span>
                        {sender.name && (
                          <span className="text-xs text-muted-foreground">
                            &lt;{sender.email}&gt;
                          </span>
                        )}
                        {receivedAt && (
                          <>
                            <span className="text-muted-foreground">•</span>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(receivedAt, { addSuffix: true })}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Subject */}
                      {reply.subject && (
                        <div className="text-sm font-medium">
                          <Mail className="inline h-3 w-3 mr-1 text-muted-foreground" />
                          {reply.subject}
                        </div>
                      )}

                      {/* Work Item Info */}
                      {workItem && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-muted-foreground">Re:</span>
                          <Link
                            href={`/work-items/${workItem.id}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {workItem.customer_name || 'Unnamed Work Item'}
                          </Link>
                          <StatusBadge status={workItem.status} />
                          <Badge variant="outline" className="text-xs">
                            {workItem.type === 'customify_order'
                              ? 'Customify'
                              : 'Custom Design'}
                          </Badge>
                          {workItem.shopify_order_number && workItem.shopify_order_id && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <a
                                href={`https://admin.shopify.com/store/gayfanclub/orders/${workItem.shopify_order_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {workItem.shopify_order_number}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                      >
                        <Link href={`/work-items/${workItem?.id}`}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open Work Item
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReplyingToId(replyingToId === reply.id ? null : reply.id)}
                      >
                        <Reply className="mr-2 h-4 w-4" />
                        Reply
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleMarkActioned(reply.id)}
                        disabled={markActioned.isPending}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Mark as Actioned
                      </Button>
                    </div>
                  </div>

                  {/* Email Preview */}
                  {cleanPreview && (
                    <div className="bg-muted/50 rounded-md p-4 text-sm">
                      <div className="line-clamp-3 text-muted-foreground leading-relaxed">
                        {cleanPreview}
                      </div>
                    </div>
                  )}

                  {/* Full Body (Expandable) */}
                  {reply.body_html && (
                    <details className="group">
                      <summary className="cursor-pointer text-sm text-primary hover:underline">
                        Show full message
                      </summary>
                      <div
                        className="mt-3 email-content prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(reply.body_html, {
                            ALLOWED_TAGS: [
                              'p',
                              'br',
                              'strong',
                              'em',
                              'u',
                              'a',
                              'ul',
                              'ol',
                              'li',
                              'h1',
                              'h2',
                              'h3',
                              'h4',
                              'div',
                              'span',
                              'table',
                              'tr',
                              'td',
                              'th',
                              'tbody',
                              'thead',
                              'img',
                              'blockquote',
                            ],
                            ALLOWED_ATTR: ['href', 'target', 'src', 'alt', 'width', 'height'],
                          }),
                        }}
                      />
                    </details>
                  )}

                  {/* Reply Composer */}
                  {replyingToId === reply.id && workItem && (
                    <div className="mt-4 pt-4 border-t">
                      <InlineEmailComposer
                        workItemId={workItem.id}
                        workItem={workItem}
                        defaultTo={reply.from_email}
                        defaultSubject={reply.subject ? `Re: ${reply.subject}` : ''}
                        onSendSuccess={handleReplySuccess}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
