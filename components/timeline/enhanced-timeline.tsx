'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  FileText, Mail, MessageSquare, Phone, Calendar,
  Clock, Star, Upload, Activity, MoreHorizontal,
  CheckCircle, Eye, Send
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { cn } from '@/lib/utils'

type TimelineEventType = 'note' | 'email' | 'call' | 'text' | 'task' | 'appointment' | 'status_change' | 'file_upload' | 'work_item_created'

interface TimelineEvent {
  id: string
  type: TimelineEventType
  timestamp: string
  title: string
  description: string
  content?: string
  metadata?: any
  user?: string
  userEmail?: string
  starred?: boolean
}

interface EnhancedTimelineProps {
  events: TimelineEvent[]
  onAddNote?: (content: string) => Promise<void>
  onToggleStar?: (eventId: string) => void
  onLogCall?: (details: any) => Promise<void>
  onCreateTask?: (details: any) => Promise<void>
}

const EVENT_ICONS: Record<TimelineEventType, any> = {
  note: FileText,
  email: Mail,
  call: Phone,
  text: MessageSquare,
  task: Clock,
  appointment: Calendar,
  status_change: Activity,
  file_upload: Upload,
  work_item_created: Activity,
}

const EVENT_COLORS: Record<TimelineEventType, string> = {
  note: 'bg-blue-50 border-l-blue-500',
  email: 'bg-blue-50 border-l-blue-600',
  call: 'bg-green-50 border-l-green-500',
  text: 'bg-purple-50 border-l-purple-500',
  task: 'bg-orange-50 border-l-orange-500',
  appointment: 'bg-pink-50 border-l-pink-500',
  status_change: 'bg-gray-50 border-l-gray-400',
  file_upload: 'bg-indigo-50 border-l-indigo-500',
  work_item_created: 'bg-gray-50 border-l-gray-400',
}

export function EnhancedTimeline({
  events,
  onAddNote,
  onToggleStar,
  onLogCall,
  onCreateTask,
}: EnhancedTimelineProps) {
  const [filter, setFilter] = useState<'all' | TimelineEventType>('all')
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'note' | 'email' | 'call' | 'task' | 'appointment'>('note')
  const [noteContent, setNoteContent] = useState('')
  const [emailThisNote, setEmailThisNote] = useState(false)

  // Count events by type
  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: events.length,
      starred: events.filter(e => e.starred).length,
    }

    events.forEach(event => {
      c[event.type] = (c[event.type] || 0) + 1
    })

    return c
  }, [events])

  // Filter events
  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events
    if (filter === 'starred') return events.filter(e => e.starred)
    return events.filter(e => e.type === filter)
  }, [events, filter])

  const toggleExpand = (eventId: string) => {
    const newExpanded = new Set(expandedEvents)
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId)
    } else {
      newExpanded.add(eventId)
    }
    setExpandedEvents(newExpanded)
  }

  const handleAddNote = async () => {
    if (!noteContent.trim() || !onAddNote) return

    await onAddNote(noteContent)
    setNoteContent('')
    setEmailThisNote(false)
  }

  const getInitials = (name?: string, email?: string) => {
    if (name) {
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
    <div className="space-y-4">
      {/* Filter Bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">HISTORY {counts.all}</h2>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={filter === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilter('all')}
                className="gap-2 h-8"
              >
                <Activity className="h-3.5 w-3.5" />
                All {counts.all}
              </Button>

              {counts.starred > 0 && (
                <Button
                  variant={filter === 'starred' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('starred' as any)}
                  className="gap-2 h-8"
                >
                  <Star className="h-3.5 w-3.5" />
                  {counts.starred}
                </Button>
              )}

              {counts.note > 0 && (
                <Button
                  variant={filter === 'note' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('note')}
                  className="gap-2 h-8"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {counts.note}
                </Button>
              )}

              {counts.email > 0 && (
                <Button
                  variant={filter === 'email' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('email')}
                  className="gap-2 h-8"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {counts.email}
                </Button>
              )}

              {counts.call > 0 && (
                <Button
                  variant={filter === 'call' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('call')}
                  className="gap-2 h-8"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {counts.call}
                </Button>
              )}

              {counts.task > 0 && (
                <Button
                  variant={filter === 'task' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('task')}
                  className="gap-2 h-8"
                >
                  <Clock className="h-3.5 w-3.5" />
                  {counts.task}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Action Tabs */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b h-auto p-0 bg-transparent">
              <TabsTrigger value="note" className="gap-2 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                <FileText className="h-4 w-4" />
                Note
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-2 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                <Mail className="h-4 w-4" />
                Email
              </TabsTrigger>
              <TabsTrigger value="call" className="gap-2 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                <Phone className="h-4 w-4" />
                Log Call
              </TabsTrigger>
              <TabsTrigger value="task" className="gap-2 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                <Clock className="h-4 w-4" />
                Task
              </TabsTrigger>
              <TabsTrigger value="appointment" className="gap-2 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                <Calendar className="h-4 w-4" />
                Appointment
              </TabsTrigger>
            </TabsList>

            <TabsContent value="note" className="p-4 space-y-3">
              <Textarea
                placeholder="Add a note... Use @ to mention team members"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="min-h-[100px] resize-none"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="emailNote"
                    checked={emailThisNote}
                    onChange={(e) => setEmailThisNote(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="emailNote" className="text-sm text-muted-foreground">
                    Email this Note
                  </label>
                </div>
                <Button
                  onClick={handleAddNote}
                  disabled={!noteContent.trim()}
                  className="h-10"
                >
                  Add Note
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="email" className="p-4">
              <p className="text-sm text-muted-foreground text-center py-8">
                Email composer appears above in the Activity tab
              </p>
            </TabsContent>

            <TabsContent value="call" className="p-4">
              <p className="text-sm text-muted-foreground text-center py-8">
                Call logging coming soon
              </p>
            </TabsContent>

            <TabsContent value="task" className="p-4">
              <p className="text-sm text-muted-foreground text-center py-8">
                Task creation coming soon
              </p>
            </TabsContent>

            <TabsContent value="appointment" className="p-4">
              <p className="text-sm text-muted-foreground text-center py-8">
                Appointment scheduling coming soon
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Timeline Events */}
      <div className="space-y-3">
        {filteredEvents.map((event) => {
          const Icon = EVENT_ICONS[event.type]
          const isExpanded = expandedEvents.has(event.id)
          const hasExpandableContent = event.content && event.content.length > 200

          return (
            <Card
              key={event.id}
              className={cn(
                'border-l-4 transition-shadow hover:shadow-md',
                EVENT_COLORS[event.type]
              )}
            >
              <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-medium text-sm">{event.title}</span>
                      {event.user && (
                        <>
                          <span className="text-muted-foreground">by</span>
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                                {getInitials(event.user, event.userEmail)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-muted-foreground truncate">
                              {event.user}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(event.timestamp), 'EEEE, MMMM d, yyyy h:mm a')}
                    </span>
                    {onToggleStar && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => onToggleStar(event.id)}
                      >
                        <Star
                          className={cn(
                            'h-4 w-4',
                            event.starred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
                          )}
                        />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="ml-8">
                  <p className="text-sm text-muted-foreground mb-2">{event.description}</p>

                  {event.content && (
                    <div className="mt-2 p-3 bg-white/50 rounded-md">
                      <div
                        className={cn(
                          'text-sm',
                          !isExpanded && hasExpandableContent && 'line-clamp-3'
                        )}
                      >
                        {event.content}
                      </div>

                      {hasExpandableContent && (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => toggleExpand(event.id)}
                          className="p-0 h-auto text-primary mt-1"
                        >
                          {isExpanded ? 'Show less' : 'More'}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Email metadata */}
                  {event.type === 'email' && event.metadata && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      {event.metadata.opened && (
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          <span>Received and Opened</span>
                        </div>
                      )}
                      {event.metadata.delivered && (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          <span>Delivered</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}

        {filteredEvents.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No {filter !== 'all' ? filter : ''} activity yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
