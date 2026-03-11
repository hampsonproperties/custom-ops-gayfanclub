'use client'

import { use, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { StatusBadge } from '@/components/custom/status-badge'
import { ChangeStatusDialog } from '@/components/work-items/change-status-dialog'
import { CloseLeadDialog } from '@/components/work-items/close-lead-dialog'
import { SendApprovalDialog } from '@/components/email/send-approval-dialog'
import { InlineEmailComposer } from '@/components/email/inline-email-composer'
import { AlternateEmailsManager } from '@/components/work-items/alternate-emails-manager'
import { useWorkItem, useUpdateWorkItem } from '@/lib/hooks/use-work-items'
import { useCommunications } from '@/lib/hooks/use-communications'
import { useFiles, useUploadFile, useDeleteFile, getFileUrl } from '@/lib/hooks/use-files'
import { useTimeline, useToggleTimelineStar } from '@/lib/hooks/use-timeline'
import { useCreateNote } from '@/lib/hooks/use-notes'
import { ArrowLeft, Mail, FileText, Upload, File as FileIcon, Trash2, Download, Image as ImageIcon, Clock, CheckCircle, Activity, ExternalLink, Phone, Building2, Calendar, DollarSign, User, ChevronDown, RefreshCw } from 'lucide-react'
import type { Database } from '@/types/database'
import { InternalNotes } from '@/components/work-items/internal-notes'
import { AssignmentManager } from '@/components/work-items/assignment-manager'
import { TagManager } from '@/components/work-items/tag-manager'
import { ValueManager } from '@/components/work-items/value-manager'
import { CustomerDetailsEditor } from '@/components/work-items/customer-details-editor'
import { ShopifyInfo } from '@/components/work-items/shopify-info'
import { InvoiceManager } from '@/components/work-items/invoice-manager'
import { EnhancedTimeline } from '@/components/timeline/enhanced-timeline'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { QueueNavigator } from '@/components/ui/queue-navigator'
import { useQueueNavigation } from '@/lib/hooks/use-queue-navigation'
import { SummaryPanel } from '@/components/ai/summary-panel'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getValidStatusesForWorkItem, getStatusLabel } from '@/lib/utils/status-transitions'
import type { WorkItemType, WorkItemStatus } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

type FileRecord = Database['public']['Tables']['files']['Row']
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { toast } from 'sonner'

// Extended work item type with fields added in migration
type WorkItemWithExtras = Database['public']['Tables']['work_items']['Row'] & {
  estimated_value?: number | null
  actual_value?: number | null
  assigned_to_email?: string | null
  assigned_at?: string | null
  assigned_by_email?: string | null
  last_activity_at?: string | null
  company_name?: string | null
  event_date?: string | null
  phone_number?: string | null
  address?: string | null
  alternate_emails?: string[] | null
}

export default function WorkItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const queue = useQueueNavigation(id, 'work-item')
  const { data: workItemData, isLoading } = useWorkItem(id)
  const workItem = workItemData as WorkItemWithExtras | undefined
  const { data: communications } = useCommunications(id)
  const { data: files } = useFiles(id)
  const { data: timeline } = useTimeline(id)
  const uploadFile = useUploadFile()
  const deleteFile = useDeleteFile()
  const updateWorkItem = useUpdateWorkItem()
  const createNote = useCreateNote()
  const toggleStar = useToggleTimelineStar()

  // Prefer linked customer's display name over work item's customer_name (which may be stale/email-only)
  const customer = (workItem as any)?.customer
  const displayName = customer?.display_name || workItem?.customer_name || workItem?.customer_email || 'Unknown Customer'

  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    kind: 'proof' as 'preview' | 'design' | 'proof' | 'other',
    note: '',
  })

  const [showStatusDialog, setShowStatusDialog] = useState(false)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [isSyncingShopify, setIsSyncingShopify] = useState(false)
  const queryClient = useQueryClient()

  const handleSyncShopify = async () => {
    setIsSyncingShopify(true)
    try {
      const response = await fetch(`/api/work-items/${id}/sync-shopify`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Sync failed')
      if (data.synced > 0) {
        toast.success(`Synced ${data.synced} new comment${data.synced === 1 ? '' : 's'} from Shopify`)
        queryClient.invalidateQueries({ queryKey: ['timeline', id] })
        queryClient.invalidateQueries({ queryKey: ['work-item', id] })
      } else {
        toast.info('Already up to date — no new comments')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync from Shopify')
    } finally {
      setIsSyncingShopify(false)
    }
  }

  const handleDirectStatusChange = async (newStatus: string) => {
    if (!newStatus || newStatus === workItem?.status) return
    const supabase = createClient()
    const { error } = await supabase
      .from('work_items')
      .update({ status: newStatus })
      .eq('id', id)
    if (error) {
      toast.error('Failed to update status')
      return
    }
    toast.success(`Status moved to ${getStatusLabel(newStatus as WorkItemStatus)}`)
    queryClient.invalidateQueries({ queryKey: ['work-item', id] })
    queryClient.invalidateQueries({ queryKey: ['work-items'] })
  }


  const handleUploadFile = async () => {
    if (!uploadForm.file) {
      toast.error('Please select a file')
      return
    }

    try {
      await uploadFile.mutateAsync({
        workItemId: id,
        file: uploadForm.file,
        kind: uploadForm.kind,
        note: uploadForm.note,
      })

      toast.success('File uploaded successfully')

      setShowUploadDialog(false)
      setUploadForm({ file: null, kind: 'proof', note: '' })
    } catch (error) {
      toast.error('Failed to upload file')
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return

    try {
      await deleteFile.mutateAsync({ fileId, workItemId: id })
      toast.success('File deleted')
    } catch (error) {
      toast.error('Failed to delete file')
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <p>Loading work item...</p>
      </div>
    )
  }

  if (!workItem) {
    return (
      <div className="p-6">
        <p>Work item not found</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-0">
      {/* Fixed Header - Clean & Professional */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="p-4">
          {/* Top Bar - Back + Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div className="flex-1 min-w-0 space-y-2">
              <Breadcrumbs
                items={[{ label: 'Projects', href: '/work-items' }]}
                current={displayName}
              />
              {queue.hasQueue && (
                <QueueNavigator
                  source={queue.source!}
                  position={queue.position!}
                  total={queue.total!}
                  onPrevious={queue.goToPrevious}
                  onNext={queue.goToNext}
                  onClose={queue.clearQueue}
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex"
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowStatusDialog(true)}
              >
                Update Status
              </Button>
            </div>
          </div>

          {/* Customer Info - Prominent but Clean */}
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">
                  {workItem.customer_id ? (
                    <Link href={`/customers/${workItem.customer_id}?tab=activity`} className="hover:underline decoration-1 underline-offset-4">
                      {displayName}
                    </Link>
                  ) : (
                    displayName
                  )}
                </h1>
                <div className="flex items-center gap-2 sm:gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                  {workItem.customer_email && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-4 w-4" />
                      {workItem.customer_email}
                    </span>
                  )}
                  {workItem.phone_number && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-4 w-4" />
                      {workItem.phone_number}
                    </span>
                  )}
                  {workItem.company_name && (
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-4 w-4" />
                      {workItem.company_name}
                    </span>
                  )}
                </div>
              </div>

              {workItem.estimated_value && (
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    ${workItem.estimated_value.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">Estimated Value</div>
                </div>
              )}
            </div>

            {/* Status Bar - Key Info at a Glance */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <StatusBadge status={workItem.status} />
                <Select onValueChange={handleDirectStatusChange}>
                  <SelectTrigger className="h-7 w-auto gap-1 text-xs px-2 border-dashed">
                    <span>Move to...</span>
                  </SelectTrigger>
                  <SelectContent>
                    {getValidStatusesForWorkItem(workItem.type as WorkItemType).map((s) => (
                      <SelectItem key={s} value={s} disabled={s === workItem.status}>
                        {getStatusLabel(s)}
                        {s === workItem.status ? ' (Current)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {workItem.next_follow_up_at && (
                <>
                  <Separator orientation="vertical" className="h-4 hidden sm:block" />
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Follow up {formatDistanceToNow(new Date(workItem.next_follow_up_at), { addSuffix: true })}
                    </span>
                  </div>
                </>
              )}

              {workItem.event_date && (
                <>
                  <Separator orientation="vertical" className="h-4 hidden sm:block" />
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Event: {new Date(workItem.event_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </>
              )}

              {workItem.assigned_to_email && (
                <>
                  <Separator orientation="vertical" className="h-4 hidden sm:block" />
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{workItem.assigned_to_email.split('@')[0]}</span>
                  </div>
                </>
              )}

              <Separator orientation="vertical" className="h-4 hidden sm:block" />
              <div className="flex items-center gap-2">
                <Switch
                  id="send-drip-status-bar"
                  checked={!(workItem.suppress_drip_emails ?? true)}
                  onCheckedChange={async (checked) => {
                    const supabase = createClient()
                    const { error } = await supabase
                      .from('work_items')
                      .update({ suppress_drip_emails: !checked })
                      .eq('id', id)
                    if (error) {
                      toast.error('Failed to update drip email setting')
                      return
                    }
                    toast.success(checked ? 'Drip emails enabled' : 'Drip emails disabled')
                    queryClient.invalidateQueries({ queryKey: ['work-item', id] })
                  }}
                />
                <label htmlFor="send-drip-status-bar" className="text-sm text-muted-foreground cursor-pointer">
                  Send drip emails
                </label>
              </div>
            </div>

            {/* Quick Info Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {workItem.design_fee_order_number && (
                <a
                  href={`https://admin.shopify.com/store/gayfanclub/orders/${workItem.design_fee_order_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Badge variant="secondary" className="gap-1 hover:bg-secondary/80">
                    <CheckCircle className="h-3 w-3 text-purple-600" />
                    Design Fee Paid
                    <ExternalLink className="h-3 w-3" />
                  </Badge>
                </a>
              )}

              {workItem.shopify_order_number && (
                <a
                  href={`https://admin.shopify.com/store/gayfanclub/orders/${workItem.shopify_order_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Badge variant="secondary" className="gap-1 hover:bg-secondary/80">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    Production Paid
                    <ExternalLink className="h-3 w-3" />
                  </Badge>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Timeline First */}
      <div className="flex-1 p-4 sm:p-6 space-y-4">
        {/* AI Summary */}
        <SummaryPanel workItemId={id} />

        <Tabs defaultValue="timeline" className="space-y-4">
          <TabsList className="flex w-full overflow-x-auto">
            <TabsTrigger value="timeline" className="gap-2">
              <Activity className="h-4 w-4" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="details" className="gap-2">
              <FileText className="h-4 w-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="files" className="gap-2">
              <ImageIcon className="h-4 w-4" />
              Files
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Shopify Orders
            </TabsTrigger>
          </TabsList>

          {/* Timeline Tab - Default View */}
          <TabsContent value="timeline" className="space-y-4">
            {/* Enhanced Timeline with Filtering */}
            <EnhancedTimeline
              events={timeline || []}
              workItemId={id}
              emailComposer={
                <InlineEmailComposer
                  workItemId={id}
                  workItem={workItem}
                  onSendSuccess={() => {}}
                />
              }
              onAddNote={async (content: string) => {
                await createNote.mutateAsync({
                  workItemId: id,
                  content,
                })
                toast.success('Note added')
              }}
              onToggleStar={(eventId: string) => {
                const event = timeline?.find(e => e.id === eventId)
                if (event) {
                  toggleStar.mutate({ eventId, eventType: event.type })
                }
              }}
            />
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Type</label>
                    <p className="mt-1 capitalize">{workItem.type.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Source</label>
                    <p className="mt-1 capitalize">{workItem.source || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Created</label>
                    <p className="mt-1">
                      {new Date(workItem.created_at || '').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Activity</label>
                    <p className="mt-1">
                      {workItem.last_activity_at
                        ? formatDistanceToNow(new Date(workItem.last_activity_at), { addSuffix: true })
                        : '-'}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Address</label>
                    <p className="mt-1 whitespace-pre-wrap">{workItem.address || '-'}</p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Assigned To</label>
                    <AssignmentManager
                      workItemId={id}
                      currentAssignee={workItem.assigned_to_email ?? null}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Estimated Value</label>
                    <ValueManager
                      workItemId={id}
                      estimatedValue={workItem.estimated_value ?? null}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Tags</label>
                  <TagManager workItemId={id} />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block">Send Drip Emails</label>
                    <p className="text-xs text-muted-foreground mt-0.5">When on, automated production update emails are sent to this customer</p>
                  </div>
                  <Switch
                    checked={!(workItem.suppress_drip_emails ?? true)}
                    onCheckedChange={async (checked) => {
                      const supabase = createClient()
                      const { error } = await supabase
                        .from('work_items')
                        .update({ suppress_drip_emails: !checked })
                        .eq('id', id)
                      if (error) {
                        toast.error('Failed to update drip email setting')
                        return
                      }
                      toast.success(checked ? 'Drip emails enabled' : 'Drip emails disabled')
                      queryClient.invalidateQueries({ queryKey: ['work-item', id] })
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <CustomerDetailsEditor workItem={workItem} />
            <AlternateEmailsManager
              workItemId={id}
              customerEmail={workItem.customer_email || ''}
              alternateEmails={workItem.alternate_emails || []}
            />
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Design Files</h3>
              <Button size="sm" onClick={() => setShowUploadDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </Button>
            </div>

            {files && files.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {files.map((file) => {
                  const url = getFileUrl(file)
                  const isImage = file.mime_type?.startsWith('image/') ||
                    file.kind === 'image' ||
                    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.original_filename)

                  return (
                    <Card key={file.id} className="group relative overflow-hidden">
                      {/* Thumbnail or icon */}
                      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                        {isImage ? (
                          <div className="aspect-square relative bg-muted">
                            <img
                              src={url}
                              alt={file.original_filename}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ExternalLink className="h-6 w-6 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-square bg-muted flex items-center justify-center">
                            <FileIcon className="h-10 w-10 text-muted-foreground" />
                          </div>
                        )}
                      </a>
                      <CardContent className="p-3">
                        <p className="text-xs font-medium truncate">{file.original_filename}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-muted-foreground capitalize">{file.kind}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleDeleteFile(file.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No files uploaded yet
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Shopify Orders Tab */}
          <TabsContent value="orders">
            {(workItem.shopify_order_id || workItem.design_fee_order_id) && (
              <div className="flex justify-end mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncShopify}
                  disabled={isSyncingShopify}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isSyncingShopify ? 'animate-spin' : ''}`} />
                  {isSyncingShopify ? 'Syncing...' : 'Sync from Shopify'}
                </Button>
              </div>
            )}
            <ShopifyInfo workItem={workItem} />
            {workItem.type === 'assisted_project' && !workItem.closed_at && (
              <div className="mt-4">
                <InvoiceManager workItem={workItem} />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <ChangeStatusDialog
        isOpen={showStatusDialog}
        onOpenChange={setShowStatusDialog}
        workItem={workItem}
      />

      <CloseLeadDialog
        isOpen={showCloseDialog}
        onOpenChange={setShowCloseDialog}
        workItemId={id}
        workItemName={displayName}
        customerId={workItem.customer_id}
      />

      <SendApprovalDialog
        open={showApprovalDialog}
        onOpenChange={setShowApprovalDialog}
        workItem={workItem}
      />

      {/* Upload File Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
            <DialogDescription>
              Upload a design proof, preview, or other file
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="file">File</Label>
              <Input
                id="file"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setUploadForm({ ...uploadForm, file })
                  }
                }}
              />
            </div>

            <div>
              <Label htmlFor="kind">Type</Label>
              <select
                id="kind"
                value={uploadForm.kind}
                onChange={(e) =>
                  setUploadForm({
                    ...uploadForm,
                    kind: e.target.value as typeof uploadForm.kind,
                  })
                }
                className="w-full p-2 border rounded"
              >
                <option value="preview">Preview</option>
                <option value="design">Design</option>
                <option value="proof">Proof</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea
                id="note"
                value={uploadForm.note}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, note: e.target.value })
                }
                placeholder="Add a note about this file..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUploadDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleUploadFile} disabled={uploadFile.isPending}>
              {uploadFile.isPending ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
