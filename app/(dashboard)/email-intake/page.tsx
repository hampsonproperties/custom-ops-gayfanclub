'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useUntriagedEmails, useTriageEmail } from '@/lib/hooks/use-communications'
import { useCreateWorkItem } from '@/lib/hooks/use-work-items'
import { Mail, User, Calendar as CalendarIcon } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function EmailIntakePage() {
  const { data: emails, isLoading } = useUntriagedEmails()
  const triageEmail = useTriageEmail()
  const createWorkItem = useCreateWorkItem()

  const [selectedEmail, setSelectedEmail] = useState<any>(null)
  const [showCreateLeadDialog, setShowCreateLeadDialog] = useState(false)
  const [leadForm, setLeadForm] = useState({
    customerName: '',
    customerEmail: '',
    title: '',
    eventDate: '',
    notes: '',
  })

  const handleCreateLead = async () => {
    if (!selectedEmail) return

    // Create work item
    const { data: workItem } = await createWorkItem.mutateAsync({
      type: 'assisted_project',
      source: 'email',
      status: 'new_inquiry',
      customer_name: leadForm.customerName,
      customer_email: leadForm.customerEmail,
      title: leadForm.title || `Inquiry from ${leadForm.customerName}`,
      event_date: leadForm.eventDate || null,
      last_contact_at: selectedEmail.received_at,
      next_follow_up_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    })

    // Attach email to work item
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
      title: '',
      eventDate: '',
      notes: '',
    })
  }

  const handleArchive = async (emailId: string) => {
    await triageEmail.mutateAsync({
      id: emailId,
      triageStatus: 'archived',
    })
  }

  const handleFlagSupport = async (emailId: string) => {
    await triageEmail.mutateAsync({
      id: emailId,
      triageStatus: 'flagged_support',
    })
  }

  const openCreateLeadDialog = (email: any) => {
    setSelectedEmail(email)
    // Pre-fill form from email
    setLeadForm({
      customerName: email.from_email.split('@')[0] || '',
      customerEmail: email.from_email,
      title: email.subject || '',
      eventDate: '',
      notes: email.body_preview || '',
    })
    setShowCreateLeadDialog(true)
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <p>Loading untriaged emails...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Untriaged Email Intake</h1>
        <p className="text-muted-foreground">
          {emails?.length || 0} new emails awaiting triage
        </p>
      </div>

      {!emails || emails.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">All caught up!</p>
            <p className="text-sm text-muted-foreground">No untriaged emails</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {emails.map((email) => (
            <Card key={email.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Sender Info */}
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-[#9C27B0]/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-[#9C27B0]" />
                    </div>
                  </div>

                  {/* Email Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{email.from_email}</p>
                        <p className="text-xs text-muted-foreground">
                          {email.received_at && formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}
                        </p>
                      </div>
                      {email.received_at && new Date().getTime() - new Date(email.received_at).getTime() < 3600000 && (
                        <Badge variant="secondary" className="text-xs">New</Badge>
                      )}
                    </div>

                    <div className="mt-2">
                      <p className="text-sm font-medium">{email.subject || '(No Subject)'}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {email.body_preview}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        className="gap-1"
                        onClick={() => openCreateLeadDialog(email)}
                      >
                        <User className="h-3 w-3" />
                        Create Lead
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-1"
                        onClick={() => handleFlagSupport(email.id)}
                      >
                        <Mail className="h-3 w-3" />
                        Flag Support
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleArchive(email.id)}
                      >
                        Archive
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Lead Dialog */}
      <Dialog open={showCreateLeadDialog} onOpenChange={setShowCreateLeadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Assisted Project Lead</DialogTitle>
            <DialogDescription>
              Create a new lead from this email inquiry
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Customer Name</label>
                <Input
                  value={leadForm.customerName}
                  onChange={(e) => setLeadForm({ ...leadForm, customerName: e.target.value })}
                  placeholder="Alex Smith"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Customer Email</label>
                <Input
                  type="email"
                  value={leadForm.customerEmail}
                  onChange={(e) => setLeadForm({ ...leadForm, customerEmail: e.target.value })}
                  placeholder="alex@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Project Title</label>
              <Input
                value={leadForm.title}
                onChange={(e) => setLeadForm({ ...leadForm, title: e.target.value })}
                placeholder="Wedding fans for Alex & Sam"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Event Date (Optional)</label>
              <Input
                type="date"
                value={leadForm.eventDate}
                onChange={(e) => setLeadForm({ ...leadForm, eventDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Initial Notes</label>
              <Textarea
                value={leadForm.notes}
                onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                placeholder="Initial inquiry details..."
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateLeadDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateLead} disabled={!leadForm.customerName || !leadForm.customerEmail}>
                Create Lead
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
