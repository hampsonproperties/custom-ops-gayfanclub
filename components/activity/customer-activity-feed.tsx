'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Label } from '@/components/ui/label'
import {
  FileText,
  Mail,
  Star,
  Send,
  Sparkles,
  Loader2,
  CheckSquare,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { cleanEmailContent, getEmailPreview } from '@/lib/utils/email-content-cleaner'
import DOMPurify from 'dompurify'
import { logger } from '@/lib/logger'
import { TaskForm } from '@/components/tasks/task-form'
import { TaskList } from '@/components/tasks/task-list'

const log = logger('customer-activity-feed')

type ActivityType = 'note' | 'email' | 'task'
type FilterType = 'all' | 'starred' | 'note' | 'email' | 'task'

const SHOPIFY_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_SHOP_DOMAIN || ''

/** Render text with Shopify order references (#1234) as clickable admin links */
function linkifyShopifyRefs(text: string): React.ReactNode {
  if (!SHOPIFY_DOMAIN) return text
  const parts = text.split(/(#\d{3,})/g)
  if (parts.length === 1) return text
  return parts.map((part, i) => {
    const match = part.match(/^#(\d{3,})$/)
    if (match) {
      return (
        <a
          key={i}
          href={`https://${SHOPIFY_DOMAIN}/admin/orders?query=%23${match[1]}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:no-underline"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      )
    }
    return part
  })
}

interface ActivityItem {
  id: string
  type: ActivityType
  content: string
  fullHtml?: string // Full HTML body for emails (rendered on expand)
  subject?: string // For emails
  created_at: string
  starred?: boolean
  user: {
    id: string
    full_name: string
    email: string
  }
  // Email specific
  delivered_at?: string
  opened_at?: string
}

interface CustomerActivityFeedProps {
  customerId: string
  customerEmail: string
}

export function CustomerActivityFeed({ customerId, customerEmail }: CustomerActivityFeedProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<ActivityType>('email')
  const [filter, setFilter] = useState<FilterType>('all')
  const [noteContent, setNoteContent] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailContent, setEmailContent] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  // Fetch activity items
  const { data: activities, isLoading } = useQuery({
    queryKey: ['customer-activity', customerId],
    queryFn: async () => {
      const supabase = createClient()

      // Fetch notes
      const { data: notes } = await supabase
        .from('customer_notes')
        .select(`
          id,
          content,
          created_at,
          starred,
          created_by_user:users!created_by_user_id(id, full_name, email)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      // Fetch emails
      const { data: emails } = await supabase
        .from('communications')
        .select(`
          id,
          subject,
          body_html,
          body_preview,
          received_at,
          from_email,
          from_name
        `)
        .eq('customer_id', customerId)
        .order('received_at', { ascending: false })

      // Fetch tasks
      let tasks: any[] = []
      try {
        const { data: tasksData } = await supabase
          .from('tasks')
          .select(`
            id,
            title,
            description,
            created_at,
            due_date,
            completed_at,
            created_by_user:users!tasks_created_by_user_id_fkey(id, full_name, email),
            assigned_to:users!tasks_assigned_to_user_id_fkey(full_name, email)
          `)
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })

        tasks = tasksData || []
      } catch (error) {
        tasks = []
      }

      // Helper to extract user object
      const getUserObject = (user: any) => {
        if (!user) return { id: '', full_name: 'System', email: '' }
        return Array.isArray(user) ? user[0] : user
      }

      // Combine all activities
      const allActivities: ActivityItem[] = [
        ...(notes || []).map(note => ({
          id: note.id,
          type: 'note' as ActivityType,
          content: note.content,
          created_at: note.created_at,
          starred: note.starred,
          user: getUserObject(note.created_by_user),
        })),
        ...(emails || []).map(email => ({
          id: email.id,
          type: 'email' as ActivityType,
          subject: email.subject,
          content: getEmailPreview(email.body_preview || email.body_html || '', 200),
          fullHtml: email.body_html || undefined,
          created_at: email.received_at,
          user: {
            id: '',
            full_name: email.from_name || 'Unknown',
            email: email.from_email || ''
          },
        })),
        ...(tasks || []).map(task => ({
          id: task.id,
          type: 'task' as ActivityType,
          content: task.description || task.title,
          created_at: task.created_at,
          due_date: task.due_date,
          completed: !!task.completed_at,
          user: getUserObject(task.created_by_user),
          assigned_to: getUserObject(task.assigned_to),
        })),
      ]

      // Sort by created_at descending
      return allActivities.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    },
  })

  // Calculate counts for filter bar
  const counts = useMemo(() => {
    if (!activities) return { all: 0, starred: 0, note: 0, email: 0, task: 0 }

    return {
      all: activities.length,
      starred: activities.filter(a => a.starred).length,
      note: activities.filter(a => a.type === 'note').length,
      email: activities.filter(a => a.type === 'email').length,
      task: activities.filter(a => a.type === 'task').length,
    }
  }, [activities])

  // Filter activities
  const filteredActivities = useMemo(() => {
    if (!activities) return []

    if (filter === 'all') return activities
    if (filter === 'starred') return activities.filter(a => a.starred)
    return activities.filter(a => a.type === filter)
  }, [activities, filter])

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase
        .from('customer_notes')
        .insert({
          customer_id: customerId,
          content: noteContent,
          created_by_user_id: user?.id,
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-activity', customerId] })
      setNoteContent('')
      toast.success('Note added')
    },
    onError: (error: any) => {
      toast.error(`Failed: ${error.message}`)
    },
  })

  // AI email generation
  const handleGenerateEmail = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter a prompt for the AI')
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch('/api/email/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          customerId,
          customerEmail,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || 'Failed to generate email'

        if (errorMessage.includes('OPENAI_API_KEY')) {
          toast.error('AI email generation is not configured yet. Please contact your administrator to set up the OpenAI API key.')
        } else {
          toast.error(errorMessage)
        }
        throw new Error(errorMessage)
      }

      const { subject, body } = await response.json()
      setEmailSubject(subject)
      setEmailContent(body)
      setAiPrompt('')
      toast.success('Email generated! Review and edit before sending.')
    } catch (error) {
      log.error('Email generation error', { error })
    } finally {
      setIsGenerating(false)
    }
  }

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          to: customerEmail,
          subject: emailSubject,
          body: emailContent,
          sentByUserId: user?.id,
        }),
      })

      if (!response.ok) throw new Error('Failed to send email')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-activity', customerId] })
      setEmailSubject('')
      setEmailContent('')
      setAiPrompt('')
      toast.success('Email sent successfully!')
    },
    onError: (error: any) => {
      toast.error(`Failed to send email: ${error.message}`)
    },
  })

  // Toggle star mutation
  const toggleStarMutation = useMutation({
    mutationFn: async ({ id, type, starred }: { id: string; type: ActivityType; starred: boolean }) => {
      const supabase = createClient()

      if (type === 'note') {
        const { error } = await supabase
          .from('customer_notes')
          .update({ starred: !starred })
          .eq('id', id)

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-activity', customerId] })
    },
  })

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedItems(newExpanded)
  }

  const getInitials = (name: string, email: string) => {
    if (name && name !== 'Unknown' && name !== 'System') {
      const parts = name.split(' ')
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      }
      return name.substring(0, 2).toUpperCase()
    }
    if (email) {
      return email.substring(0, 2).toUpperCase()
    }
    return '??'
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <Card className="p-2 sm:p-3">
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          <Button
            variant={filter === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
            className="gap-1 sm:gap-2 h-10 px-3 sm:px-4"
          >
            All <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] flex items-center justify-center">{counts.all}</Badge>
          </Button>
          <Button
            variant={filter === 'starred' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('starred')}
            className="gap-1 sm:gap-2 h-10 px-3 sm:px-4"
          >
            <Star className="h-4 w-4" />
            <span className="hidden xs:inline">Starred</span>
            <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] flex items-center justify-center">{counts.starred}</Badge>
          </Button>
          <Button
            variant={filter === 'note' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('note')}
            className="gap-1 sm:gap-2 h-10 px-3 sm:px-4"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden xs:inline">Notes</span>
            <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] flex items-center justify-center">{counts.note}</Badge>
          </Button>
          <Button
            variant={filter === 'email' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('email')}
            className="gap-1 sm:gap-2 h-10 px-3 sm:px-4"
          >
            <Mail className="h-4 w-4" />
            <span className="hidden xs:inline">Emails</span>
            <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] flex items-center justify-center">{counts.email}</Badge>
          </Button>
          <Button
            variant={filter === 'task' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('task')}
            className="gap-1 sm:gap-2 h-10 px-3 sm:px-4"
          >
            <CheckSquare className="h-4 w-4" />
            <span className="hidden xs:inline">Tasks</span>
            <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] flex items-center justify-center">{counts.task}</Badge>
          </Button>
        </div>
      </Card>

      {/* Composer */}
      <Card className="p-4 sm:p-6">
        <div className="space-y-4">
          {/* Tab Selector */}
          <div className="flex gap-1 sm:gap-2 border-b">
            <Button
              variant={activeTab === 'note' ? 'ghost' : 'ghost'}
              size="default"
              onClick={() => setActiveTab('note')}
              className={cn(
                'rounded-b-none border-b-2 h-10 sm:h-11 px-3 sm:px-4 flex-1 sm:flex-none',
                activeTab === 'note' ? 'border-primary' : 'border-transparent'
              )}
            >
              <FileText className="mr-1.5 sm:mr-2 h-4 w-4" />
              <span className="text-sm sm:text-base">Note</span>
            </Button>
            <Button
              variant={activeTab === 'email' ? 'ghost' : 'ghost'}
              size="default"
              onClick={() => setActiveTab('email')}
              className={cn(
                'rounded-b-none border-b-2 h-10 sm:h-11 px-3 sm:px-4 flex-1 sm:flex-none',
                activeTab === 'email' ? 'border-primary' : 'border-transparent'
              )}
            >
              <Mail className="mr-1.5 sm:mr-2 h-4 w-4" />
              <span className="text-sm sm:text-base">Email</span>
            </Button>
            <Button
              variant={activeTab === 'task' ? 'ghost' : 'ghost'}
              size="default"
              onClick={() => setActiveTab('task')}
              className={cn(
                'rounded-b-none border-b-2 h-10 sm:h-11 px-3 sm:px-4 flex-1 sm:flex-none',
                activeTab === 'task' ? 'border-primary' : 'border-transparent'
              )}
            >
              <CheckSquare className="mr-1.5 sm:mr-2 h-4 w-4" />
              <span className="text-sm sm:text-base">Task</span>
            </Button>
          </div>

          {/* Note Composer */}
          {activeTab === 'note' && (
            <>
              <Textarea
                placeholder="Add a note about this customer..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="min-h-[120px] resize-none text-base"
              />
              <div className="flex justify-end">
                <Button
                  className="rounded-full"
                  onClick={() => addNoteMutation.mutate()}
                  disabled={addNoteMutation.isPending || !noteContent.trim()}
                >
                  Add Note
                </Button>
              </div>
            </>
          )}

          {/* Email Composer */}
          {activeTab === 'email' && (
            <>
              {/* AI Prompt Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Type a prompt: 'Send friendly check-in' or 'Ask about their event'..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleGenerateEmail()
                    }
                  }}
                  className="text-base flex-1"
                  disabled={isGenerating}
                />
                <Button
                  onClick={handleGenerateEmail}
                  disabled={isGenerating || !aiPrompt.trim()}
                  className="gap-1.5 sm:gap-2 px-3 sm:px-4"
                  variant="secondary"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="hidden xs:inline">Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span className="hidden sm:inline">Generate with AI</span>
                      <span className="sm:hidden">AI</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Generated Email Fields */}
              {(emailSubject || emailContent) && (
                <>
                  <div className="border-t pt-4 mt-4">
                    <Label className="text-sm text-muted-foreground mb-2 block">Review and edit before sending:</Label>
                    <Input
                      placeholder="Subject"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="text-base mb-3"
                    />
                    <Textarea
                      placeholder={`Email to ${customerEmail}...`}
                      value={emailContent}
                      onChange={(e) => setEmailContent(e.target.value)}
                      className="min-h-[200px] resize-none text-base"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEmailSubject('')
                        setEmailContent('')
                      }}
                      className="h-10"
                    >
                      Clear
                    </Button>
                    <Button
                      className="rounded-full gap-1.5 sm:gap-2 h-10"
                      onClick={() => sendEmailMutation.mutate()}
                      disabled={sendEmailMutation.isPending || !emailSubject.trim() || !emailContent.trim()}
                    >
                      {sendEmailMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="hidden xs:inline">Sending...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          <span className="hidden xs:inline">Send Email</span>
                          <span className="xs:hidden">Send</span>
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}

          {/* Task Composer */}
          {activeTab === 'task' && (
            <div className="space-y-4">
              <TaskForm customerId={customerId} />
              <TaskList customerId={customerId} />
            </div>
          )}
        </div>
      </Card>

      {/* Timeline */}
      <div className="space-y-4">
        {isLoading ? (
          <Card className="p-6">
            <div className="text-center text-muted-foreground">Loading activity...</div>
          </Card>
        ) : filteredActivities.length === 0 ? (
          <Card className="p-12">
            <div className="text-center text-muted-foreground">No activity yet</div>
          </Card>
        ) : (
          filteredActivities.map((activity) => {
            const isExpanded = expandedItems.has(activity.id)
            const shouldTruncate = activity.content.length > 300
            const hasFullEmail = activity.type === 'email' && !!activity.fullHtml

            return (
              <Card
                key={activity.id}
                className={cn(
                  'p-4',
                  activity.type === 'email' && 'bg-blue-50/50 cursor-pointer hover:shadow-sm transition-shadow',
                  activity.type === 'note' && 'bg-gray-50',
                )}
                onClick={hasFullEmail ? () => toggleExpanded(activity.id) : undefined}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {activity.type === 'email' && <Mail className="h-5 w-5 text-blue-600" />}
                    {activity.type === 'note' && <FileText className="h-5 w-5 text-gray-600" />}

                    <span className="text-sm font-medium">
                      {activity.type === 'email' && 'Email from'}
                      {activity.type === 'note' && 'Note from'}
                    </span>

                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                        {getInitials(activity.user.full_name, activity.user.email)}
                      </AvatarFallback>
                    </Avatar>

                    <span className="text-sm font-medium">{activity.user.full_name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(activity.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleStarMutation.mutate({
                          id: activity.id,
                          type: activity.type,
                          starred: activity.starred || false
                        })
                      }}
                    >
                      <Star
                        className={cn(
                          'h-4 w-4',
                          activity.starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'
                        )}
                      />
                    </Button>
                  </div>
                </div>

                {/* Email Content */}
                {activity.type === 'email' ? (
                  <div className="space-y-2">
                    {/* Subject Line */}
                    {activity.subject && (
                      <div className="font-medium text-base">{activity.subject}</div>
                    )}

                    {/* Email Preview / Full Content */}
                    {isExpanded && activity.fullHtml ? (
                      <div
                        className="text-sm prose prose-sm max-w-none [&_img]:max-w-full [&_table]:text-sm overflow-x-auto"
                        onClick={(e) => e.stopPropagation()}
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(activity.fullHtml, {
                            ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'div', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'hr', 'pre', 'code'],
                            ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'width', 'height', 'style', 'class'],
                          })
                        }}
                      />
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        {activity.content}{hasFullEmail && !isExpanded ? '...' : ''}
                      </div>
                    )}

                    {/* Expand hint */}
                    {hasFullEmail && !isExpanded && (
                      <span className="text-xs text-primary font-medium">Click to read full email</span>
                    )}
                    {hasFullEmail && isExpanded && (
                      <span className="text-xs text-muted-foreground font-medium">Click to collapse</span>
                    )}
                  </div>
                ) : (
                  /* Non-email content */
                  <div className="text-sm whitespace-pre-wrap">
                    {shouldTruncate && !isExpanded
                      ? linkifyShopifyRefs(activity.content.substring(0, 300) + '...')
                      : linkifyShopifyRefs(activity.content)}
                  </div>
                )}

                {/* Email Actions */}
                {activity.type === 'email' && (
                  <div className="mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveTab('email')
                        setEmailSubject(activity.subject ? `Re: ${activity.subject}` : 'Re: ')
                        setEmailContent(`\n\n---\nOn ${format(new Date(activity.created_at), 'MMM d, yyyy')} ${activity.user.full_name} wrote:\n\n${activity.content}`)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className="gap-2"
                    >
                      <Mail className="h-4 w-4" />
                      Reply
                    </Button>
                  </div>
                )}
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
