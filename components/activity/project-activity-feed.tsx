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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  FileText,
  Mail,
  CheckSquare,
  Star,
  MoreHorizontal,
  User,
  Clock,
  CheckCircle,
  Send,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type ActivityType = 'note' | 'email' | 'task'
type FilterType = 'all' | 'starred' | 'note' | 'email' | 'task'

interface ActivityItem {
  id: string
  type: ActivityType
  content: string
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
  // Task specific
  assigned_to?: {
    full_name: string
    email: string
  }
  due_date?: string
  completed?: boolean
}

interface ProjectActivityFeedProps {
  projectId: string
  customerId: string
  customerEmail: string
}

export function ProjectActivityFeed({ projectId, customerId, customerEmail }: ProjectActivityFeedProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<ActivityType>('note')
  const [filter, setFilter] = useState<FilterType>('all')
  const [noteContent, setNoteContent] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailContent, setEmailContent] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [emailThisNote, setEmailThisNote] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  // Fetch activity items
  const { data: activities, isLoading } = useQuery({
    queryKey: ['project-activity', projectId],
    queryFn: async () => {
      const supabase = createClient()

      // Fetch notes
      const { data: notes } = await supabase
        .from('work_item_notes')
        .select(`
          id,
          content,
          created_at,
          starred,
          created_by_user:users!created_by_user_id(id, full_name, email)
        `)
        .eq('work_item_id', projectId)
        .order('created_at', { ascending: false })

      // Fetch emails (wrapped in try-catch for backward compatibility)
      let emails: any[] = []
      try {
        const { data: emailsData } = await supabase
          .from('communications')
          .select(`
            id,
            subject,
            body_html,
            body_text,
            received_at,
            sent_by_user:users!sent_by_user_id(id, full_name, email),
            delivered_at,
            opened_at
          `)
          .eq('work_item_id', projectId)
          .order('received_at', { ascending: false })

        emails = emailsData || []
      } catch (error) {
        console.warn('Failed to fetch emails:', error)
      }

      // Fetch tasks (if table exists)
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
            completed,
            created_by_user:users!created_by_user_id(id, full_name, email),
            assigned_to:users!assigned_to_user_id(full_name, email)
          `)
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })

        tasks = tasksData || []
      } catch (error) {
        // Tasks table might not exist yet, that's okay
        tasks = []
      }

      // Helper to extract user object (Supabase sometimes returns array for relations)
      const getUserObject = (user: any) => {
        if (!user) return { id: '', full_name: 'Unknown', email: '' }
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
          content: email.body_text || email.body_html || '',
          created_at: email.received_at,
          delivered_at: email.delivered_at,
          opened_at: email.opened_at,
          user: getUserObject(email.sent_by_user),
        })),
        ...(tasks || []).map(task => ({
          id: task.id,
          type: 'task' as ActivityType,
          content: task.description || task.title,
          created_at: task.created_at,
          due_date: task.due_date,
          completed: task.completed,
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

      if (emailThisNote) {
        // Create email communication
        const { error } = await supabase
          .from('communications')
          .insert({
            work_item_id: projectId,
            customer_id: customerId,
            subject: 'Note from team',
            body_text: noteContent,
            sent_by_user_id: user?.id,
            direction: 'outbound',
          })

        if (error) throw error
      } else {
        // Create internal note
        const { error } = await supabase
          .from('work_item_notes')
          .insert({
            work_item_id: projectId,
            content: noteContent,
            created_by_user_id: user?.id,
            is_internal: true,
          })

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-activity', projectId] })
      setNoteContent('')
      setEmailThisNote(false)
      toast.success(emailThisNote ? 'Email sent' : 'Note added')
    },
    onError: (error: any) => {
      toast.error(`Failed: ${error.message}`)
    },
  })

  // Toggle star mutation
  const toggleStarMutation = useMutation({
    mutationFn: async ({ id, type, starred }: { id: string; type: ActivityType; starred: boolean }) => {
      const supabase = createClient()

      if (type === 'note') {
        const { error } = await supabase
          .from('work_item_notes')
          .update({ starred: !starred })
          .eq('id', id)

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-activity', projectId] })
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
          projectId,
          customerId,
          customerEmail,
        }),
      })

      if (!response.ok) throw new Error('Failed to generate email')

      const { subject, body } = await response.json()
      setEmailSubject(subject)
      setEmailContent(body)
      setAiPrompt('')
      toast.success('Email generated! Review and edit before sending.')
    } catch (error) {
      toast.error('Failed to generate email')
      console.error(error)
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
          workItemId: projectId,
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
      queryClient.invalidateQueries({ queryKey: ['project-activity', projectId] })
      setEmailSubject('')
      setEmailContent('')
      setAiPrompt('')
      toast.success('Email sent successfully!')
    },
    onError: (error: any) => {
      toast.error(`Failed to send email: ${error.message}`)
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
    if (name && name !== 'Unknown') {
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
      {/* Filter Bar - Follow Up Boss Style */}
      <Card className="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={filter === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
            className="gap-2"
          >
            <MoreHorizontal className="h-4 w-4" />
            All {counts.all}
          </Button>

          {counts.starred > 0 && (
            <Button
              variant={filter === 'starred' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter('starred')}
              className="gap-2"
            >
              <Star className="h-4 w-4" />
              {counts.starred}
            </Button>
          )}

          <Button
            variant={filter === 'note' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('note')}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            {counts.note}
          </Button>

          <Button
            variant={filter === 'email' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('email')}
            className="gap-2"
          >
            <Mail className="h-4 w-4" />
            {counts.email}
          </Button>

          {counts.task > 0 && (
            <Button
              variant={filter === 'task' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter('task')}
              className="gap-2"
            >
              <CheckSquare className="h-4 w-4" />
              {counts.task}
            </Button>
          )}
        </div>
      </Card>

      {/* Quick Action Tabs */}
      <Card>
        <div className="border-b">
          <div className="flex items-center">
            <Button
              variant={activeTab === 'note' ? 'ghost' : 'ghost'}
              className={cn(
                'rounded-none border-b-2 border-transparent',
                activeTab === 'note' && 'border-primary'
              )}
              onClick={() => setActiveTab('note')}
            >
              <FileText className="mr-2 h-4 w-4" />
              Note
            </Button>
            <Button
              variant={activeTab === 'email' ? 'ghost' : 'ghost'}
              className={cn(
                'rounded-none border-b-2 border-transparent',
                activeTab === 'email' && 'border-primary'
              )}
              onClick={() => setActiveTab('email')}
            >
              <Mail className="mr-2 h-4 w-4" />
              Email
            </Button>
            <Button
              variant={activeTab === 'task' ? 'ghost' : 'ghost'}
              className={cn(
                'rounded-none border-b-2 border-transparent',
                activeTab === 'task' && 'border-primary'
              )}
              onClick={() => setActiveTab('task')}
            >
              <CheckSquare className="mr-2 h-4 w-4" />
              Task
            </Button>
          </div>
        </div>

        {/* Composer Area */}
        <div className="p-6 space-y-4">
          {activeTab === 'note' && (
            <>
              <Textarea
                placeholder="Add a note about this project..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="min-h-[120px] resize-none text-base"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="email-note"
                    checked={emailThisNote}
                    onCheckedChange={(checked) => setEmailThisNote(!!checked)}
                  />
                  <Label htmlFor="email-note" className="text-sm text-muted-foreground cursor-pointer">
                    Email this Note
                  </Label>
                </div>
                <Button
                  onClick={() => addNoteMutation.mutate()}
                  disabled={!noteContent.trim() || addNoteMutation.isPending}
                  className="rounded-full"
                >
                  Add Note
                </Button>
              </div>
            </>
          )}

          {activeTab === 'email' && (
            <>
              {/* AI Prompt Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Type a prompt: 'Send quote follow-up' or 'Ask about event details'..."
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
                  className="gap-2"
                  variant="secondary"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate with AI
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
                    >
                      Clear
                    </Button>
                    <Button
                      className="rounded-full gap-2"
                      onClick={() => sendEmailMutation.mutate()}
                      disabled={sendEmailMutation.isPending || !emailSubject.trim() || !emailContent.trim()}
                    >
                      {sendEmailMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Send Email
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}

          {activeTab === 'task' && (
            <div className="text-center py-8 text-muted-foreground">
              Task creation coming soon
            </div>
          )}
        </div>
      </Card>

      {/* Timeline Items */}
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

            return (
              <Card
                key={activity.id}
                className={cn(
                  'p-4',
                  activity.type === 'email' && 'bg-blue-50/50',
                  activity.type === 'note' && 'bg-gray-50',
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {activity.type === 'email' && <Mail className="h-5 w-5 text-blue-600" />}
                    {activity.type === 'note' && <FileText className="h-5 w-5 text-gray-600" />}
                    {activity.type === 'task' && <CheckSquare className="h-5 w-5 text-orange-600" />}

                    <span className="text-sm font-medium">
                      {activity.type === 'email' && 'Email sent by'}
                      {activity.type === 'note' && 'Note from'}
                      {activity.type === 'task' && 'Task assigned to'}
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
                      {format(new Date(activity.created_at), 'EEEE, MMMM d, yyyy h:mm a')}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => toggleStarMutation.mutate({
                        id: activity.id,
                        type: activity.type,
                        starred: activity.starred || false
                      })}
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

                {/* Content */}
                {activity.type === 'email' && activity.subject && (
                  <div className="font-semibold mb-2 text-lg">Subject: {activity.subject}</div>
                )}

                <div className="text-sm whitespace-pre-wrap">
                  {shouldTruncate && !isExpanded
                    ? activity.content.substring(0, 300) + '...'
                    : activity.content}
                </div>

                {shouldTruncate && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => toggleExpanded(activity.id)}
                    className="p-0 h-auto mt-2 text-primary"
                  >
                    {isExpanded ? 'Show less' : 'More ↓'}
                  </Button>
                )}

                {/* Email Status & Reply */}
                {activity.type === 'email' && (
                  <div className="flex items-center justify-between mt-3">
                    {activity.delivered_at && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>
                          Delivered{activity.opened_at && ' and Opened'} {formatDistanceToNow(new Date(activity.opened_at || activity.delivered_at), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
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

                {/* Task Info */}
                {activity.type === 'task' && (
                  <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                    {activity.assigned_to && (
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {activity.assigned_to.full_name}
                      </div>
                    )}
                    {activity.due_date && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        Due: {format(new Date(activity.due_date), 'MMM d, yyyy')}
                      </div>
                    )}
                    {activity.completed && (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Completed
                      </Badge>
                    )}
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
