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
  ExternalLink,
  ShoppingBag,
} from 'lucide-react'
import { StatusBadge } from '@/components/custom/status-badge'
import { format, formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { ProjectActivityFeed } from '@/components/activity/project-activity-feed'
import { FileUpload } from '@/components/files/file-upload'
import { useQueryClient } from '@tanstack/react-query'
import { UpdateStatusDialog } from '@/components/projects/update-status-dialog'
import { EmailComposer } from '@/components/email/email-composer'
import { AssignDesignerDialog } from '@/components/projects/assign-designer-dialog'
import { EventCountdown } from '@/components/projects/event-countdown'

interface ProjectDetailViewProps {
  projectId: string
  customerId: string
  customerName: string
}

export function ProjectDetailView({ projectId, customerId, customerName }: ProjectDetailViewProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('activity')
  const [showFileUpload, setShowFileUpload] = useState(false)

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

      // Fetch associated Shopify order if shopify_order_number exists
      if (data.shopify_order_number) {
        const { data: shopifyOrder } = await supabase
          .from('shopify_orders')
          .select('shopify_order_id, shopify_order_number')
          .eq('shopify_order_number', data.shopify_order_number)
          .maybeSingle()

        if (shopifyOrder) {
          data.shopify_order = shopifyOrder
        }
      }

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

  // Timeline is now handled by ProjectActivityFeed component

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
                  <EventCountdown eventDate={project.event_date} />
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
                {project.shopify_order_number && project.shopify_order?.shopify_order_id && (
                  <a
                    href={`https://${process.env.NEXT_PUBLIC_SHOPIFY_SHOP_DOMAIN}/admin/orders/${project.shopify_order.shopify_order_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    <span>Order {project.shopify_order_number}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <UpdateStatusDialog
                projectId={projectId}
                currentStatus={project.status}
                onStatusUpdated={() => {
                  queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] })
                }}
              />
              <AssignDesignerDialog
                projectId={projectId}
                currentDesignerId={project.assigned_to_user_id}
                onAssigned={() => {
                  queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] })
                }}
              />
              <EmailComposer
                recipientEmail={project.customer?.email || ''}
                recipientName={project.customer?.display_name || customerName}
                customerId={customerId}
                projectId={projectId}
                subject={`Re: ${project.title || `Order #${project.shopify_order_number}`}`}
                onEmailSent={() => {
                  queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] })
                }}
                trigger={
                  <Button size="sm">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Email Customer
                  </Button>
                }
              />
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

        {/* Activity Tab - Follow Up Boss Style */}
        <TabsContent value="activity" className="mt-6">
          <ProjectActivityFeed
            projectId={projectId}
            customerId={customerId}
            customerEmail={project.customer?.email || ''}
          />
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="space-y-4 mt-6">
          {/* File Upload */}
          {showFileUpload && (
            <FileUpload
              projectId={projectId}
              customerId={customerId}
              onUploadComplete={() => {
                queryClient.invalidateQueries({ queryKey: ['project-files', projectId] })
                setShowFileUpload(false)
              }}
            />
          )}

          {/* Existing Files */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Project Files & Proofs</CardTitle>
                <Button size="sm" onClick={() => setShowFileUpload(!showFileUpload)}>
                  <Upload className="mr-2 h-4 w-4" />
                  {showFileUpload ? 'Cancel Upload' : 'Upload Files'}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            const response = await fetch(`/api/files/${file.id}/download`)
                            const data = await response.json()
                            if (data.url) {
                              window.open(data.url, '_blank')
                            }
                          } catch (error) {
                            console.error('Download error:', error)
                          }
                        }}
                      >
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
