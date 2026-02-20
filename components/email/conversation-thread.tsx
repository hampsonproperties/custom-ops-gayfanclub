'use client'

import { formatDistanceToNow } from 'date-fns'
import { Mail, ArrowDownCircle, ArrowUpCircle, Paperclip, ChevronDown, ChevronUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useState } from 'react'
import DOMPurify from 'dompurify'
import type { Database } from '@/types/database'
import {
  parseEmailAddress,
  formatEmailList,
  separateQuotedContent,
  formatEmailTimestamp,
} from '@/lib/utils/email-formatting'

type Communication = Database['public']['Tables']['communications']['Row']

interface ConversationThreadProps {
  communications: Communication[]
}

export function ConversationThread({ communications }: ConversationThreadProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [showQuotedIds, setShowQuotedIds] = useState<Set<string>>(new Set())

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedIds(newExpanded)
  }

  const toggleQuoted = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newShowQuoted = new Set(showQuotedIds)
    if (newShowQuoted.has(id)) {
      newShowQuoted.delete(id)
    } else {
      newShowQuoted.add(id)
    }
    setShowQuotedIds(newShowQuoted)
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
        const showQuoted = showQuotedIds.has(comm.id)
        const isInbound = comm.direction === 'inbound'
        const timestamp = new Date(comm.received_at || comm.sent_at || comm.created_at)

        // Parse sender and recipients
        const sender = parseEmailAddress(comm.from_email || '')
        const recipients = formatEmailList(comm.to_emails, { maxDisplay: 2 })

        // Separate quoted content for cleaner display
        const { body, hasQuoted, quotedContent } = comm.body_html
          ? separateQuotedContent(comm.body_html)
          : { body: comm.body_preview || '', hasQuoted: false, quotedContent: '' }

        return (
          <Card
            key={comm.id}
            className={`transition-all hover:shadow-md ${
              isInbound
                ? 'border-l-4 border-l-blue-500'
                : 'border-l-4 border-l-green-500'
            }`}
          >
            <div className="p-4 space-y-3">
              {/* Compact Header - Always Visible */}
              <div
                className="flex items-start justify-between gap-4 cursor-pointer"
                onClick={() => toggleExpanded(comm.id)}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {isInbound ? (
                    <ArrowDownCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <ArrowUpCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Sender/Recipient Name */}
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        {isInbound ? sender.displayName : recipients.displayText}
                      </span>
                      {comm.has_attachments && (
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>

                    {/* Subject */}
                    <div className="text-sm text-foreground truncate">
                      {comm.subject || '(no subject)'}
                    </div>

                    {/* Preview when collapsed */}
                    {!isExpanded && comm.body_preview && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                        {comm.body_preview}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatEmailTimestamp(timestamp)}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Expanded Email Details */}
              {isExpanded && (
                <div className="space-y-3">
                  {/* Full Email Headers */}
                  <div className="space-y-1 text-xs border-t pt-3">
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-12 flex-shrink-0">From:</span>
                      <div className="flex-1">
                        <span className="font-medium">{sender.name || sender.email}</span>
                        {sender.name && (
                          <span className="text-muted-foreground ml-1">
                            &lt;{sender.email}&gt;
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-12 flex-shrink-0">To:</span>
                      <div className="flex-1">
                        {comm.to_emails.map((email, idx) => {
                          const parsed = parseEmailAddress(email)
                          return (
                            <span key={idx}>
                              {idx > 0 && ', '}
                              <span className="font-medium">
                                {parsed.name || parsed.email}
                              </span>
                              {parsed.name && (
                                <span className="text-muted-foreground">
                                  {' '}
                                  &lt;{parsed.email}&gt;
                                </span>
                              )}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-12 flex-shrink-0">Date:</span>
                      <span>
                        {timestamp.toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-12 flex-shrink-0">Subject:</span>
                      <span className="font-medium">{comm.subject || '(no subject)'}</span>
                    </div>
                  </div>

                  {/* Email Body */}
                  <div className="border-t pt-3">
                    {comm.body_html ? (
                      <div className="email-content space-y-3">
                        <div
                          className="prose prose-sm max-w-none prose-headings:mb-2 prose-headings:mt-3 prose-p:my-2 prose-ul:my-2 prose-ol:my-2"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(body, {
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
                                'h5',
                                'h6',
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
                              ALLOWED_ATTR: [
                                'href',
                                'target',
                                'src',
                                'alt',
                                'width',
                                'height',
                                'class',
                              ],
                            }),
                          }}
                        />

                        {/* Quoted/Previous Email Content */}
                        {hasQuoted && (
                          <div className="border-t pt-3 mt-3">
                            <button
                              onClick={(e) => toggleQuoted(comm.id, e)}
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                              {showQuoted ? (
                                <>
                                  <ChevronUp className="h-3 w-3" />
                                  Hide previous message
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3" />
                                  Show previous message
                                </>
                              )}
                            </button>

                            {showQuoted && (
                              <div
                                className="mt-3 pl-4 border-l-2 border-muted text-sm text-muted-foreground prose prose-sm max-w-none opacity-60"
                                dangerouslySetInnerHTML={{
                                  __html: DOMPurify.sanitize(quotedContent, {
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
                                      'div',
                                      'span',
                                      'blockquote',
                                    ],
                                    ALLOWED_ATTR: ['href', 'target'],
                                  }),
                                }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {comm.body_preview || 'No content available'}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
