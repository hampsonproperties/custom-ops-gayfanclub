'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useUntriagedEmails, useTriageEmail } from '@/lib/hooks/use-communications'
import { useCreateWorkItem } from '@/lib/hooks/use-work-items'
import { Mail, Inbox, Archive, Link as LinkIcon, Plus, CheckCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { parseEmailAddress } from '@/lib/utils/email-formatting'
import DOMPurify from 'dompurify'

export default function InboxPage() {
  const { data: emails, isLoading } = useUntriagedEmails()
  const triageEmail = useTriageEmail()
  const createWorkItem = useCreateWorkItem()

  const [selectedEmail, setSelectedEmail] = useState<any>(null)
  const [showCreateLeadDialog, setShowCreateLeadDialog] = useState(false)
  const [leadForm, setLeadForm] = useState({
    customer_name: '',
    customer_email: '',
    title: '',
    estimated_value: '',
    notes: '',
  })

  const handleCreateLead = async () => {
    if (!selectedEmail) return

    try {
      const workItem = await createWorkItem.mutateAsync({
        type: 'assisted_project',
        source: 'email',
        status: 'new_inquiry',
        customer_name: leadForm.customer_name || selectedEmail.from_name || selectedEmail.from_email,
        customer_email: leadForm.customer_email || selectedEmail.from_email,
        title: leadForm.title || selectedEmail.subject,
        estimated_value: leadForm.estimated_value ? parseFloat(leadForm.estimated_value) : null,
        notes: leadForm.notes || null,
      } as any)

      // Link email to work item
      await triageEmail.mutateAsync({
        id: selectedEmail.id,
        triageStatus: 'created_lead',
        workItemId: workItem.id,
      })

      toast.success('Lead created successfully')
      setShowCreateLeadDialog(false)
      setSelectedEmail(null)
      setLeadForm({ customer_name: '', customer_email: '', title: '', estimated_value: '', notes: '' })
    } catch (error) {
      toast.error('Failed to create lead')
    }
  }

  const handleArchive = async (email: any) => {
    try {
      await triageEmail.mutateAsync({
        id: email.id,
        triageStatus: 'archived',
      })
      toast.success('Email archived')
    } catch (error) {
      toast.error('Failed to archive email')
    }
  }

  const openCreateLeadDialog = (email: any) => {
    setSelectedEmail(email)
    setLeadForm({
      customer_name: email.from_name || '',
      customer_email: email.from_email || '',
      title: email.subject || '',
      estimated_value: '',
      notes: '',
    })
    setShowCreateLeadDialog(true)
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-muted-foreground">Loading inbox...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Inbox className="h-8 w-8" />
          Inbox - Triage New Emails
        </h1>
        <p className="text-muted-foreground">
          Quick triage: Create leads, link to existing, or archive
        </p>
      </div>

      {/* Emails List */}
      {emails && emails.length > 0 ? (
        <div className="space-y-3">
          {emails.map((email) => (
            <Card key={email.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Email Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {email.from_name || email.from_email}
                        </span>
                        {email.from_name && (
                          <span className="text-sm text-muted-foreground">
                            &lt;{email.from_email}&gt;
                          </span>
                        )}
                      </div>
                      <div className="text-lg font-semibold mb-1">{email.subject}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}
                      </div>
                    </div>
                    <Badge variant="secondary">{email.category}</Badge>
                  </div>

                  {/* Email Preview */}
                  <div className="text-sm text-muted-foreground line-clamp-2">
                    {email.body_preview}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => openCreateLeadDialog(email)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Create Lead
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleArchive(email)}
                      className="gap-2"
                    >
                      <Archive className="h-4 w-4" />
                      Archive as Junk
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-600 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Inbox Zero! 🎉</h3>
            <p className="text-muted-foreground">
              All emails have been triaged. New emails will appear here.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Create Lead Dialog */}
      <Dialog open={showCreateLeadDialog} onOpenChange={setShowCreateLeadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Lead from Email</DialogTitle>
            <DialogDescription>
              Convert this email into a sales lead
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Customer Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Customer Name</label>
                <Input
                  value={leadForm.customer_name}
                  onChange={(e) =>
                    setLeadForm({ ...leadForm, customer_name: e.target.value })
                  }
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Customer Email</label>
                <Input
                  value={leadForm.customer_email}
                  onChange={(e) =>
                    setLeadForm({ ...leadForm, customer_email: e.target.value })
                  }
                  placeholder="john@example.com"
                />
              </div>
            </div>

            {/* Project Title */}
            <div>
              <label className="text-sm font-medium">Project Title</label>
              <Input
                value={leadForm.title}
                onChange={(e) => setLeadForm({ ...leadForm, title: e.target.value })}
                placeholder="Custom fans for wedding"
              />
            </div>

            {/* Estimated Value */}
            <div>
              <label className="text-sm font-medium">Estimated Value (Optional)</label>
              <Input
                type="number"
                value={leadForm.estimated_value}
                onChange={(e) =>
                  setLeadForm({ ...leadForm, estimated_value: e.target.value })
                }
                placeholder="2500"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium">Initial Notes (Optional)</label>
              <Textarea
                value={leadForm.notes}
                onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                placeholder="Notes about this inquiry..."
                rows={3}
              />
            </div>

            {/* Email Preview */}
            {selectedEmail && (
              <div className="border rounded-lg p-3 bg-muted/50">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Email Preview:
                </div>
                <div className="text-sm">{selectedEmail.body_preview}</div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowCreateLeadDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateLead}
                disabled={createWorkItem.isPending || triageEmail.isPending}
              >
                {createWorkItem.isPending || triageEmail.isPending
                  ? 'Creating...'
                  : 'Create Lead'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
