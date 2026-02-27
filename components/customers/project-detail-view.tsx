'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  FileText,
  MessageSquare,
  Info,
  Calendar,
  DollarSign,
  User as UserIcon,
  Upload,
  Download,
} from 'lucide-react'
import { StatusBadge } from '@/components/custom/status-badge'
import { format, formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

interface ProjectDetailViewProps {
  projectId: string
  customerId: string
  customerName: string
}

export function ProjectDetailView({ projectId, customerId, customerName }: ProjectDetailViewProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('activity')

  // Fetch project details
  const { data: project, isLoading } = useQuery({
    queryKey: ['project-detail', projectId],
    queryFn: async () => {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('work_items')
        .select(`
          *,
          customer:customers(*),
          assigned_to:users!assigned_to_user_id(id, full_name, email)
        `)
        .eq('id', projectId)
        .single()

      if (error) throw error
      return data
    },
  })

  // Fetch project files
  const { data: files } = useQuery({
    queryKey: ['project-files', projectId],
    queryFn: async () => {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('work_item_id', projectId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
  })

  // Fetch project notes
  const { data: notes } = useQuery({
    queryKey: ['project-notes', projectId],
    queryFn: async () => {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('work_item_notes')
        .select(`
          *,
          created_by_user:users!created_by_user_id(full_name, email)
        `)
        .eq('work_item_id', projectId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
  })

  // Fetch project timeline/activity
  const { data: timeline } = useQuery({
    queryKey: ['project-timeline', projectId],
    queryFn: async () => {
      const supabase = createClient()

      // Get status change events
      const { data: statusChanges, error: statusError } = await supabase
        .from('work_item_status_changes')
        .select('*, user:users(full_name, email)')
        .eq('work_item_id', projectId)
        .order('changed_at', { ascending: false })

      // Get notes
      const { data: notesList, error: notesError } = await supabase
        .from('work_item_notes')
        .select('*, created_by_user:users!created_by_user_id(full_name, email)')
        .eq('work_item_id', projectId)
        .order('created_at', { ascending: false })

      // Get file uploads
      const { data: filesList, error: filesError } = await supabase
        .from('files')
        .select('*, uploaded_by:users(full_name, email)')
        .eq('work_item_id', projectId)
        .order('created_at', { ascending: false })

      // Combine and sort by date
      const allEvents = [
        ...(statusChanges || []).map(e => ({ ...e, type: 'status_change', timestamp: e.changed_at })),
        ...(notesList || []).map(e => ({ ...e, type: 'note', timestamp: e.created_at })),
        ...(filesList || []).map(e => ({ ...e, type: 'file', timestamp: e.created_at })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      return allEvents
    },
  })

  const handleBack = () => {
    router.push(`/customers/${customerId}`)
  }

  if (isLoading || !project) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb and Back Button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to {customerName}
        </Button>
        <div className="text-sm text-muted-foreground">
          <Link href={`/customers/${customerId}`} className="hover:underline">
            {customerName}
          </Link>
          {' > '}
          <span className="font-medium text-foreground">{project.title || 'Untitled Project'}</span>
        </div>
      </div>

      {/* Project Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <CardTitle className="text-2xl">
                  {project.title || 'Untitled Project'}
                </CardTitle>
                <StatusBadge status={project.status} />
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {project.event_date && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span>Event: {format(new Date(project.event_date), 'MMM d, yyyy')}</span>
                  </div>
                )}
                {project.estimated_value && (
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4" />
                    <span>${project.estimated_value.toLocaleString()}</span>
                  </div>
                )}
                {project.assigned_to && (
                  <div className="flex items-center gap-1.5">
                    <UserIcon className="h-4 w-4" />
                    <span>Assigned to: {project.assigned_to.full_name || project.assigned_to.email}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                Update Status
              </Button>
              <Button size="sm">
                <MessageSquare className="mr-2 h-4 w-4" />
                Email Customer
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Project Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="activity" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-2">
            <FileText className="h-4 w-4" />
            Files ({files?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="details" className="gap-2">
            <Info className="h-4 w-4" />
            Details
          </TabsTrigger>
        </TabsList>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Project Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {timeline && timeline.length > 0 ? (
                <div className="space-y-4">
                  {timeline.map((event: any, index) => (
                    <div key={`${event.type}-${event.id || index}`} className="flex gap-4 border-l-2 border-muted pl-4 pb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">
                            {event.type === 'status_change' && 'Status Changed'}
                            {event.type === 'note' && 'Note Added'}
                            {event.type === 'file' && 'File Uploaded'}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {event.type === 'status_change' && event.user?.full_name}
                            {event.type === 'note' && event.created_by_user?.full_name}
                            {event.type === 'file' && event.uploaded_by?.full_name}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {event.type === 'status_change' && `Changed status to: ${event.new_status}`}
                          {event.type === 'note' && event.content}
                          {event.type === 'file' && `Uploaded: ${event.filename}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No activity yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Project Files & Proofs</CardTitle>
                <Button size="sm">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload File
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {files && files.length > 0 ? (
                <div className="space-y-3">
                  {files.map((file: any) => (
                    <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium text-sm">{file.filename}</div>
                          <div className="text-xs text-muted-foreground">
                            Uploaded {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No files uploaded yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Project Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Type</div>
                  <div className="text-sm mt-1">{project.type?.replace(/_/g, ' ') || 'Not specified'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Status</div>
                  <div className="mt-1"><StatusBadge status={project.status} /></div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Created</div>
                  <div className="text-sm mt-1">{format(new Date(project.created_at), 'MMM d, yyyy')}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Last Updated</div>
                  <div className="text-sm mt-1">{formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
