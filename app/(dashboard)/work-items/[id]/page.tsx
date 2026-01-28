'use client'

import { use, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/custom/status-badge'
import { useWorkItem } from '@/lib/hooks/use-work-items'
import { useCommunications, useSendEmail } from '@/lib/hooks/use-communications'
import { useFiles, useUploadFile, useDeleteFile, getFileUrl } from '@/lib/hooks/use-files'
import { ArrowLeft, Mail, FileText, Info, Send, Upload, File as FileIcon, Trash2, Download, Image as ImageIcon } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { toast } from 'sonner'

export default function WorkItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: workItem, isLoading } = useWorkItem(id)
  const { data: communications } = useCommunications(id)
  const { data: files } = useFiles(id)
  const sendEmail = useSendEmail()
  const uploadFile = useUploadFile()
  const deleteFile = useDeleteFile()

  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [emailForm, setEmailForm] = useState({
    to: '',
    subject: '',
    body: '',
  })

  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    kind: 'proof' as 'preview' | 'design' | 'proof' | 'other',
    note: '',
  })

  const handleOpenEmailDialog = () => {
    // Pre-fill with customer email and last subject
    const lastEmail = communications?.[0]
    setEmailForm({
      to: workItem?.customer_email || '',
      subject: lastEmail?.subject ? `RE: ${lastEmail.subject}` : '',
      body: '',
    })
    setShowEmailDialog(true)
  }

  const handleSendEmail = async () => {
    if (!emailForm.to || !emailForm.subject || !emailForm.body) {
      toast.error('Please fill in all email fields')
      return
    }

    try {
      await sendEmail.mutateAsync({
        workItemId: id,
        to: emailForm.to,
        subject: emailForm.subject,
        body: emailForm.body,
      })

      toast.success('Email sent successfully')

      setShowEmailDialog(false)
      setEmailForm({ to: '', subject: '', body: '' })
    } catch (error) {
      toast.error('Failed to send email')
    }
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

        <StatusBadge status={workItem.status} />
      </div>

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
              <span className="text-sm text-muted-foreground">Event Date</span>
              <p className="font-medium">{workItem.event_date || '-'}</p>
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
              {communications && communications.length > 0 ? (
                <div className="space-y-4">
                  {communications.map((comm) => (
                    <div key={comm.id} className="flex gap-4 border-l-2 border-muted pl-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">
                            {comm.direction === 'inbound' ? 'Received' : 'Sent'} Email
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {comm.received_at && formatDistanceToNow(new Date(comm.received_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm mt-1">{comm.subject}</p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {comm.body_preview}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No activity yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communication">
          <Card>
            <CardHeader>
              <CardTitle>Email Communication</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button className="w-full" onClick={handleOpenEmailDialog}>
                  <Send className="h-4 w-4 mr-2" />
                  Send Email
                </Button>

                {communications && communications.length > 0 ? (
                  <div className="space-y-3 mt-6">
                    {communications.map((comm) => (
                      <Card key={comm.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">{comm.subject}</p>
                              <p className="text-xs text-muted-foreground">
                                {comm.direction === 'inbound' ? `From: ${comm.from_email}` : `To: ${comm.to_emails.join(', ')}`}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {comm.received_at && formatDistanceToNow(new Date(comm.received_at), { addSuffix: true })}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No emails yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files">
          <Card>
            <CardHeader>
              <CardTitle>Files & Design Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button className="w-full" onClick={() => setShowUploadDialog(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </Button>

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
                                {file.note && (
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

        <TabsContent value="details">
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
                  <p className="font-medium">{workItem.shopify_order_number || '-'}</p>
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send Email</DialogTitle>
            <DialogDescription>
              Send an email to the customer about this work item
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email-to">To</Label>
              <Input
                id="email-to"
                type="email"
                value={emailForm.to}
                onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })}
                placeholder="customer@example.com"
              />
            </div>
            <div>
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                value={emailForm.subject}
                onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                placeholder="Email subject"
              />
            </div>
            <div>
              <Label htmlFor="email-body">Message</Label>
              <Textarea
                id="email-body"
                rows={12}
                value={emailForm.body}
                onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
                placeholder="Type your message here..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendEmail} disabled={sendEmail.isPending}>
              <Send className="h-4 w-4 mr-2" />
              {sendEmail.isPending ? 'Sending...' : 'Send Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  )
}
