'use client'

import { useState } from 'react'
import { useFlaggedSupportEmails, useTriageEmail } from '@/lib/hooks/use-communications'
import { useCreateWorkItem } from '@/lib/hooks/use-work-items'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Flag, Mail, MessageSquare, Archive, Package } from 'lucide-react'

export default function SupportQueuePage() {
  const { data: supportEmails = [], isLoading } = useFlaggedSupportEmails()
  const triageEmail = useTriageEmail()
  const createWorkItem = useCreateWorkItem()

  const [selectedEmail, setSelectedEmail] = useState<any>(null)
  const [showReplyDialog, setShowReplyDialog] = useState(false)
  const [showCreateLeadDialog, setShowCreateLeadDialog] = useState(false)

  const [replyForm, setReplyForm] = useState({
    subject: '',
    body: '',
  })

  const [leadForm, setLeadForm] = useState({
    customerName: '',
    customerEmail: '',
    eventDate: '',
    notes: '',
  })

  const handleOpenReply = (email: any) => {
    setSelectedEmail(email)
    setReplyForm({
      subject: `RE: ${email.subject}`,
      body: '',
    })
    setShowReplyDialog(true)
  }

  const handleOpenCreateLead = (email: any) => {
    setSelectedEmail(email)
    setLeadForm({
      customerName: email.from_email?.split('@')[0] || '',
      customerEmail: email.from_email || '',
      eventDate: '',
      notes: email.body_preview || '',
    })
    setShowCreateLeadDialog(true)
  }

  const handleArchive = async (emailId: string) => {
    await triageEmail.mutateAsync({
      id: emailId,
      triageStatus: 'archived',
    })
  }

  const handleSendReply = async () => {
    // TODO: Implement send email functionality
    // For now, just close the dialog
    setShowReplyDialog(false)
    setSelectedEmail(null)
  }

  const handleCreateLead = async () => {
    if (!selectedEmail) return

    const { data: workItem } = await createWorkItem.mutateAsync({
      type: 'assisted_project',
      source: 'email',
      status: 'new_inquiry',
      customer_name: leadForm.customerName,
      customer_email: leadForm.customerEmail,
      event_date: leadForm.eventDate || null,
      title: leadForm.notes.substring(0, 100), // Use notes as title
      last_contact_at: selectedEmail.received_at,
      next_follow_up_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    })

    await triageEmail.mutateAsync({
      id: selectedEmail.id,
      triageStatus: 'created_lead',
      workItemId: workItem?.id,
    })

    setShowCreateLeadDialog(false)
    setSelectedEmail(null)
    setLeadForm({
      customerName: '',
      customerEmail: '',
      eventDate: '',
      notes: '',
    })
  }

  if (isLoading) {
    return <div className="p-6">Loading support queue...</div>
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Support Queue</h1>
          <p className="text-muted-foreground mt-1">
            Emails flagged for customer support review
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          <Flag className="h-4 w-4 mr-2" />
          {supportEmails.length} Flagged
        </Badge>
      </div>

      {supportEmails.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No support emails</h3>
              <p className="text-muted-foreground">
                Emails flagged for support will appear here
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {supportEmails.map((email) => (
            <Card key={email.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-1">{email.subject}</CardTitle>
                    <CardDescription className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        {email.from_email}
                      </span>
                      <span className="text-xs">
                        {email.received_at && new Date(email.received_at).toLocaleString()}
                      </span>
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-[#9C27B0] text-white">
                    <Flag className="h-3 w-3 mr-1" />
                    Support
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                  {email.body_preview}
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleOpenReply(email)}
                    size="sm"
                    variant="default"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Reply
                  </Button>
                  <Button
                    onClick={() => handleOpenCreateLead(email)}
                    size="sm"
                    variant="outline"
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Create Work Item
                  </Button>
                  <Button
                    onClick={() => handleArchive(email.id)}
                    size="sm"
                    variant="outline"
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reply Dialog */}
      <Dialog open={showReplyDialog} onOpenChange={setShowReplyDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reply to Customer</DialogTitle>
            <DialogDescription>
              Send a reply to {selectedEmail?.from_email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reply-subject">Subject</Label>
              <Input
                id="reply-subject"
                value={replyForm.subject}
                onChange={(e) => setReplyForm({ ...replyForm, subject: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="reply-body">Message</Label>
              <Textarea
                id="reply-body"
                rows={10}
                value={replyForm.body}
                onChange={(e) => setReplyForm({ ...replyForm, body: e.target.value })}
                placeholder="Type your reply here..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReplyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendReply}>Send Reply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Lead Dialog */}
      <Dialog open={showCreateLeadDialog} onOpenChange={setShowCreateLeadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Work Item from Email</DialogTitle>
            <DialogDescription>
              Convert this support email to a work item
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="lead-name">Customer Name</Label>
              <Input
                id="lead-name"
                value={leadForm.customerName}
                onChange={(e) => setLeadForm({ ...leadForm, customerName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="lead-email">Customer Email</Label>
              <Input
                id="lead-email"
                type="email"
                value={leadForm.customerEmail}
                onChange={(e) => setLeadForm({ ...leadForm, customerEmail: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="lead-event-date">Event Date (Optional)</Label>
              <Input
                id="lead-event-date"
                type="date"
                value={leadForm.eventDate}
                onChange={(e) => setLeadForm({ ...leadForm, eventDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="lead-notes">Notes</Label>
              <Textarea
                id="lead-notes"
                rows={4}
                value={leadForm.notes}
                onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateLeadDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateLead}>Create Work Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
