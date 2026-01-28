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
import { ArrowLeft, Mail, FileText, Info, Send } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { toast } from 'sonner'

export default function WorkItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: workItem, isLoading } = useWorkItem(id)
  const { data: communications } = useCommunications(id)
  const sendEmail = useSendEmail()

  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [emailForm, setEmailForm] = useState({
    to: '',
    subject: '',
    body: '',
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
    </div>
  )
}
