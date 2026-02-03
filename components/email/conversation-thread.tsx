'use client'

import { formatDistanceToNow } from 'date-fns'
import { Mail, ArrowDownCircle, ArrowUpCircle, Paperclip } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useState } from 'react'
import DOMPurify from 'dompurify'
import type { Database } from '@/types/database'

type Communication = Database['public']['Tables']['communications']['Row']

interface ConversationThreadProps {
  communications: Communication[]
}

export function ConversationThread({ communications }: ConversationThreadProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedIds(newExpanded)
  }

  // Sort reverse chronologically (newest first)
  const sortedCommunications = [...communications].sort((a, b) => {
    const dateA = new Date(a.received_at || a.sent_at || a.created_at)
    const dateB = new Date(b.received_at || b.sent_at || b.created_at)
    return dateB.getTime() - dateA.getTime()
  })

  if (communications.length === 0) {
    return (
      <div className="text-center py-8">
        <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No email history yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sortedCommunications.map((comm) => {
        const isExpanded = expandedIds.has(comm.id)
        const isInbound = comm.direction === 'inbound'
        const timestamp = new Date(comm.received_at || comm.sent_at || comm.created_at)

        return (
          <Card
            key={comm.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              isInbound
                ? 'border-l-4 border-l-blue-500'
                : 'border-l-4 border-l-green-500'
            }`}
            onClick={() => toggleExpanded(comm.id)}
          >
            <div className="p-4 space-y-2">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {isInbound ? (
                    <ArrowDownCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <ArrowUpCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {comm.subject || '(no subject)'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isInbound
                        ? `From: ${comm.from_email}`
                        : `To: ${comm.to_emails.join(', ')}`}
                    </div>
                    {comm.has_attachments && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Paperclip className="h-3 w-3" />
                        <span>Has attachments</span>
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(timestamp, { addSuffix: true })}
                </span>
              </div>

              {/* Preview or Full Body */}
              {isExpanded ? (
                <div className="mt-3 pt-3 border-t">
                  {comm.body_html ? (
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(comm.body_html, {
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
                          ],
                          ALLOWED_ATTR: ['href', 'target', 'style', 'class', 'src', 'alt'],
                        }),
                      }}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">
                      {comm.body_preview || 'No content available'}
                    </p>
                  )}
                </div>
              ) : (
                comm.body_preview && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                    {comm.body_preview}
                  </p>
                )
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
