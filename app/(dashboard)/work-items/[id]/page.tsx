'use client'

import { use, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/custom/status-badge'
import { ChangeStatusDialog } from '@/components/work-items/change-status-dialog'
import { CloseLeadDialog } from '@/components/work-items/close-lead-dialog'
import { SendApprovalDialog } from '@/components/email/send-approval-dialog'
import { ConversationThread } from '@/components/email/conversation-thread'
import { InlineEmailComposer } from '@/components/email/inline-email-composer'
import { AlternateEmailsManager } from '@/components/work-items/alternate-emails-manager'
import { FollowUpActionBar } from '@/components/work-items/follow-up-action-bar'
import { useWorkItem, useUpdateWorkItem } from '@/lib/hooks/use-work-items'
import { useCommunications } from '@/lib/hooks/use-communications'
import { useFiles, useUploadFile, useDeleteFile, getFileUrl } from '@/lib/hooks/use-files'
import { useTimeline } from '@/lib/hooks/use-timeline'
import { ArrowLeft, Mail, FileText, Info, Send, Upload, File as FileIcon, Trash2, Download, Image as ImageIcon, Clock, CheckCircle, FileUp, Activity, ExternalLink, MailCheck } from 'lucide-react'
import type { Database } from '@/types/database'

type FileRecord = Database['public']['Tables']['files']['Row']
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { toast } from 'sonner'
import DOMPurify from 'dompurify'
import { parseEmailAddress, extractEmailPreview } from '@/lib/utils/email-formatting'

export default function WorkItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: workItem, isLoading } = useWorkItem(id)
  const { data: communications } = useCommunications(id)
  const { data: files } = useFiles(id)
  const { data: timeline } = useTimeline(id)
  const uploadFile = useUploadFile()
  const deleteFile = useDeleteFile()
  const updateWorkItem = useUpdateWorkItem()


  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    kind: 'proof' as 'preview' | 'design' | 'proof' | 'other',
    note: '',
  })

  const [showStatusDialog, setShowStatusDialog] = useState(false)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [showCloseDialog, setShowCloseDialog] = useState(false)


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
      toast.success('File deleted successfully')
    } catch (error) {
      toast.error('Failed to delete file')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadForm({ ...uploadForm, file })
    }
  }

  const handleToggleCustomerArtwork = async (checked: boolean) => {
    if (!workItem) return

    try {
      await updateWorkItem.mutateAsync({
        id: workItem.id,
        updates: { customer_providing_artwork: checked }
      })
      toast.success(
        checked
          ? 'Marked as customer providing artwork'
          : 'Removed customer artwork flag'
      )
    } catch (error) {
      toast.error('Failed to update setting')
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/work-items">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>

        <div className="flex-1">
          <h1 className="text-3xl font-bold">{workItem.customer_name || 'Unknown Customer'}</h1>
          <p className="text-muted-foreground">{workItem.title || workItem.customer_email}</p>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={workItem.status} />
          {!workItem.closed_at && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowStatusDialog(true)}
              >
                Change Status
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCloseDialog(true)}
              >
                Close Lead
              </Button>
            </>
          )}
          {workItem.closed_at && (
            <span className="text-sm text-muted-foreground">
              Closed {formatDistanceToNow(new Date(workItem.closed_at), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>

      {/* Follow-Up Action Bar */}
      <FollowUpActionBar workItem={workItem} />

      {/* Key Details */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-4 gap-6">
            <div>
              <span className="text-sm text-muted-foreground">Type</span>
              <p className="font-medium capitalize">{workItem.type.replace('_', ' ')}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Customer Email</span>
              <p className="font-medium">{workItem.customer_email || '-'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Shopify Order</span>
              {workItem.shopify_order_number && workItem.shopify_order_id ? (
                <a
                  href={`https://admin.shopify.com/store/gayfanclub/orders/${workItem.shopify_order_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                >
                  {workItem.shopify_order_number}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <p className="font-medium">{workItem.shopify_order_number || '-'}</p>
              )}
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Next Follow-Up</span>
              <p className="font-medium">
                {workItem.next_follow_up_at
                  ? formatDistanceToNow(new Date(workItem.next_follow_up_at), { addSuffix: true })
                  : '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline" className="gap-2">
            <FileText className="h-4 w-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="communication" className="gap-2">
            <Mail className="h-4 w-4" />
            Communication
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-2">
            <FileIcon className="h-4 w-4" />
            Files
            {files && files.length > 0 && (
              <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
                {files.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="details" className="gap-2">
            <Info className="h-4 w-4" />
            Details
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {timeline && timeline.length > 0 ? (
                <div className="space-y-6">
                  {timeline.map((event) => {
                    const getIcon = () => {
                      switch (event.type) {
                        case 'status_change':
                          return <CheckCircle className="h-5 w-5 text-[#4CAF50]" />
                        case 'email':
                          return <Mail className="h-5 w-5 text-[#2196F3]" />
                        case 'file_upload':
                          return <FileUp className="h-5 w-5 text-[#9C27B0]" />
                        case 'work_item_created':
                          return <Activity className="h-5 w-5 text-[#FF9800]" />
                        default:
                          return <Clock className="h-5 w-5 text-muted-foreground" />
                      }
                    }

                    const getBorderColor = () => {
                      switch (event.type) {
                        case 'status_change':
                          return 'border-l-[#4CAF50]'
                        case 'email':
                          return 'border-l-[#2196F3]'
                        case 'file_upload':
                          return 'border-l-[#9C27B0]'
                        case 'work_item_created':
                          return 'border-l-[#FF9800]'
                        default:
                          return 'border-l-muted'
                      }
                    }

                    // Special handling for email events
                    const isEmailEvent = event.type === 'email'
                    let emailFrom = ''
                    let emailSubject = ''
                    let emailPreview = ''

                    if (isEmailEvent && event.metadata) {
                      // Parse email metadata for cleaner display
                      if (event.metadata.from) {
                        const parsed = parseEmailAddress(event.metadata.from as string)
                        emailFrom = parsed.displayName
                      }
                      emailSubject = (event.metadata.subject as string) || '(no subject)'
                      if (event.metadata.preview) {
                        emailPreview = extractEmailPreview(
                          event.metadata.preview as string,
                          null,
                          150
                        )
                      }
                    }

                    return (
                      <div
                        key={event.id}
                        className={`flex gap-4 border-l-4 ${getBorderColor()} pl-4 py-2`}
                      >
                        <div className="flex-shrink-0 mt-1">{getIcon()}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{event.title}</span>
                            {event.user && (
                              <span className="text-xs text-muted-foreground">
                                by {event.user}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(event.timestamp), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>

                          {/* Email-specific clean display */}
                          {isEmailEvent ? (
                            <div className="mt-2 space-y-1">
                              {emailFrom && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">From: </span>
                                  <span className="font-medium">{emailFrom}</span>
                                </div>
                              )}
                              {emailSubject && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Subject: </span>
                                  <span className="font-medium">{emailSubject}</span>
                                </div>
                              )}
                              {emailPreview && (
                                <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded line-clamp-2">
                                  {emailPreview}
                                </p>
                              )}
                            </div>
                          ) : (
                            <>
                              <p className="text-sm text-muted-foreground mt-1">
                                {event.description}
                              </p>
                              {event.metadata?.preview && (
                                <p className="text-sm text-muted-foreground mt-2 p-3 bg-muted rounded-md line-clamp-3">
                                  {event.metadata.preview}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No activity yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communication" className="space-y-6">
          {/* Conversation Thread */}
          {communications && communications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Email History</CardTitle>
              </CardHeader>
              <CardContent>
                <ConversationThread communications={communications} />
              </CardContent>
            </Card>
          )}

          {/* No emails message with link to search page */}
          {(!communications || communications.length === 0) && workItem.customer_email && (
            <Card>
              <CardContent className="p-6 text-center space-y-4">
                <p className="text-sm text-muted-foreground">No email history yet</p>
                <p className="text-xs text-muted-foreground">
                  Browse recent emails and link the right one to this work item
                </p>
                <Link href={`/work-items/${id}/link-emails`}>
                  <Button variant="outline" size="sm">
                    Find & Link Emails
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Inline Email Composer */}
          <InlineEmailComposer
            workItemId={id}
            workItem={workItem}
            defaultTo={workItem.customer_email || ''}
            defaultSubject={
              communications && communications.length > 0
                ? `RE: ${communications[0].subject}`
                : ''
            }
          />
        </TabsContent>

        <TabsContent value="files">
          <Card>
            <CardHeader>
              <CardTitle>Files & Design Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => setShowUploadDialog(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload File
                  </Button>
                  {workItem.type === 'customify_order' && (
                    <Button
                      className="flex-1"
                      variant="secondary"
                      onClick={() => setShowApprovalDialog(true)}
                      disabled={!workItem.customer_email}
                    >
                      <MailCheck className="h-4 w-4 mr-2" />
                      Send Approval Email
                    </Button>
                  )}
                </div>

                {files && files.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                    {files.map((file) => {
                      const fileUrl = getFileUrl(file)
                      const isImage = file.mime_type?.startsWith('image/')
                      const isExternal = file.storage_bucket === 'customify' || file.storage_bucket === 'external'

                      return (
                        <Card key={file.id} className="overflow-hidden">
                          <CardContent className="p-0">
                            {isImage ? (
                              <div className="aspect-square bg-muted relative">
                                <img
                                  src={fileUrl}
                                  alt={file.original_filename}
                                  className="object-cover w-full h-full"
                                  loading="lazy"
                                />
                              </div>
                            ) : (
                              <div className="aspect-square bg-muted flex items-center justify-center">
                                <FileIcon className="h-16 w-16 text-muted-foreground" />
                              </div>
                            )}
                            <div className="p-4 space-y-3">
                              <div>
                                <p className="font-medium text-sm truncate">{file.original_filename}</p>
                                <p className="text-xs text-muted-foreground capitalize">
                                  {file.kind} {file.version > 1 && `v${file.version}`}
                                  {isExternal && ' (Customify)'}
                                </p>
                                {file.note && !file.note.startsWith('Backfilled') && (
                                  <p className="text-xs text-muted-foreground mt-1">{file.note}</p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => window.open(fileUrl, '_blank')}
                                >
                                  {isImage ? <ImageIcon className="h-3 w-3 mr-1" /> : <Download className="h-3 w-3 mr-1" />}
                                  {isImage ? 'View' : 'Download'}
                                </Button>
                                {!isExternal && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteFile(file.id)}
                                    disabled={deleteFile.isPending}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No files uploaded yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <span className="text-sm text-muted-foreground">Quantity</span>
                  <p className="font-medium">{workItem.quantity || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Grip Color</span>
                  <p className="font-medium">{workItem.grip_color || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Ship By Date</span>
                  <p className="font-medium">{workItem.ship_by_date || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Shopify Order</span>
                  {workItem.shopify_order_number && workItem.shopify_order_id ? (
                    <a
                      href={`https://admin.shopify.com/store/gayfanclub/orders/${workItem.shopify_order_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                    >
                      {workItem.shopify_order_number}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <p className="font-medium">{workItem.shopify_order_number || '-'}</p>
                  )}
                </div>
                {workItem.design_preview_url && (
                  <div className="col-span-2">
                    <span className="text-sm text-muted-foreground">Design Preview</span>
                    <div className="mt-2">
                      <Button variant="outline" size="sm" onClick={() => window.open(workItem.design_preview_url!, '_blank')}>
                        View Design
                      </Button>
                    </div>
                  </div>
                )}
                <div className="col-span-2 pt-4 border-t">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="customer-artwork"
                      checked={workItem.customer_providing_artwork || false}
                      onCheckedChange={handleToggleCustomerArtwork}
                      disabled={updateWorkItem.isPending}
                    />
                    <div className="space-y-1">
                      <Label
                        htmlFor="customer-artwork"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Customer is providing their own artwork
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        When enabled, this order will be marked as "awaiting customer files" until artwork is received, even if deposit is paid.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alternate Emails Manager */}
          {workItem.customer_email && (
            <AlternateEmailsManager
              workItemId={workItem.id}
              customerEmail={workItem.customer_email}
              alternateEmails={workItem.alternate_emails || []}
            />
          )}

          {/* Related Orders - show for assisted projects with both design fee and production orders */}
          {workItem.type === 'assisted_project' && (workItem.design_fee_order_number || workItem.shopify_order_number) && (
            <Card>
              <CardHeader>
                <CardTitle>Related Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {workItem.design_fee_order_number && (
                    <div className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Design Fee Order</p>
                        <p className="text-sm text-muted-foreground">
                          Initial payment for custom design work
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {workItem.design_fee_order_id ? (
                          <a
                            href={`https://admin.shopify.com/store/gayfanclub/orders/${workItem.design_fee_order_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                          >
                            {workItem.design_fee_order_number}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <p className="font-medium">{workItem.design_fee_order_number}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {workItem.shopify_order_number && (
                    <div className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Production Order</p>
                        <p className="text-sm text-muted-foreground">
                          Final invoice for manufacturing and shipping
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {workItem.shopify_order_id ? (
                          <a
                            href={`https://admin.shopify.com/store/gayfanclub/orders/${workItem.shopify_order_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                          >
                            {workItem.shopify_order_number}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <p className="font-medium">{workItem.shopify_order_number}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>


      {/* Upload File Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
            <DialogDescription>
              Upload a design proof, preview, or other file to this work item
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="file-upload">File</Label>
              <Input
                id="file-upload"
                type="file"
                onChange={handleFileChange}
                accept="image/*,application/pdf"
              />
              {uploadForm.file && (
                <p className="text-sm text-muted-foreground mt-1">
                  Selected: {uploadForm.file.name}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="file-kind">File Type</Label>
              <select
                id="file-kind"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={uploadForm.kind}
                onChange={(e) => setUploadForm({ ...uploadForm, kind: e.target.value as any })}
              >
                <option value="proof">Proof (Design we created)</option>
                <option value="preview">Preview</option>
                <option value="design">Final Design</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label htmlFor="file-note">Note (Optional)</Label>
              <Textarea
                id="file-note"
                rows={3}
                value={uploadForm.note}
                onChange={(e) => setUploadForm({ ...uploadForm, note: e.target.value })}
                placeholder="Add notes about this file..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUploadFile} disabled={!uploadForm.file || uploadFile.isPending}>
              <Upload className="h-4 w-4 mr-2" />
              {uploadFile.isPending ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Status Dialog */}
      <ChangeStatusDialog
        workItem={workItem}
        isOpen={showStatusDialog}
        onOpenChange={setShowStatusDialog}
      />

      {/* Close Lead Dialog */}
      <CloseLeadDialog
        workItemId={workItem.id}
        workItemName={workItem.customer_name || workItem.customer_email || 'this lead'}
        isOpen={showCloseDialog}
        onOpenChange={setShowCloseDialog}
      />

      {/* Send Approval Email Dialog */}
      <SendApprovalDialog
        open={showApprovalDialog}
        onOpenChange={setShowApprovalDialog}
        workItem={workItem}
        onSuccess={() => {
          // Refresh the work item and communications after successful send
          toast.success('Work item updated to awaiting approval')
        }}
      />
    </div>
  )
}
