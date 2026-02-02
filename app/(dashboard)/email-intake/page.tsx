'use client'

import { useState, useMemo, useEffect } from 'react'
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useUntriagedEmails, useTriageEmail, useSendEmail, useEmailThread } from '@/lib/hooks/use-communications'
import { useCreateWorkItem } from '@/lib/hooks/use-work-items'
import { Mail, User, Calendar as CalendarIcon, ChevronDown, ChevronUp, Reply, Archive, Flag, FileText, Code } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import DOMPurify from 'dompurify'
import { toast } from 'sonner'

type Email = {
  id: string
  from_email: string
  to_emails: string[]
  subject: string | null
  body_preview: string | null
  body_html: string | null
  received_at: string | null
  provider_thread_id: string | null
  has_attachments: boolean
}

export default function EmailIntakePage() {
  const { data: emails, isLoading, refetch } = useUntriagedEmails()
  const triageEmail = useTriageEmail()
  const createWorkItem = useCreateWorkItem()
  const sendEmail = useSendEmail()

  const [selectedEmail, setSelectedEmail] = useState<any>(null)
  const [showCreateLeadDialog, setShowCreateLeadDialog] = useState(false)
  const [showEmailDetailSheet, setShowEmailDetailSheet] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importLimit, setImportLimit] = useState(100)
  const [importDays, setImportDays] = useState(60)
  const [replyText, setReplyText] = useState('')
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'html' | 'text'>('text')

  const { data: threadEmails } = useEmailThread(selectedEmail?.provider_thread_id)

  const [leadForm, setLeadForm] = useState({
    customerName: '',
    customerEmail: '',
    title: '',
    eventDate: '',
    notes: '',
  })

  // Group emails by sender
  const emailGroups = useMemo(() => {
    if (!emails) return []

    const groups = new Map<string, Email[]>()

    emails.forEach((email) => {
      const key = email.from_email
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(email as Email)
    })

    // Convert to array and sort by most recent email
    return Array.from(groups.entries())
      .map(([sender, emails]) => ({
        sender,
        emails: emails.sort((a, b) =>
          new Date(b.received_at || 0).getTime() - new Date(a.received_at || 0).getTime()
        ),
        latestEmail: emails[0],
        count: emails.length,
      }))
      .sort((a, b) =>
        new Date(b.latestEmail.received_at || 0).getTime() -
        new Date(a.latestEmail.received_at || 0).getTime()
      )
  }, [emails])

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
      next_follow_up_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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

  const handleReply = async () => {
    if (!selectedEmail || !replyText.trim()) return

    await sendEmail.mutateAsync({
      workItemId: selectedEmail.work_item_id || '',
      to: selectedEmail.from_email,
      subject: `Re: ${selectedEmail.subject || ''}`,
      body: replyText,
    })

    setReplyText('')
    setShowReplyForm(false)
    setShowEmailDetailSheet(false)
  }

  const openCreateLeadDialog = (email: any) => {
    setSelectedEmail(email)
    setLeadForm({
      customerName: email.from_email.split('@')[0] || '',
      customerEmail: email.from_email,
      title: email.subject || '',
      eventDate: '',
      notes: email.body_preview || '',
    })
    setShowCreateLeadDialog(true)
  }

  const openEmailDetail = (email: any) => {
    setSelectedEmail(email)
    setShowReplyForm(false)
    setReplyText('')
    setShowEmailDetailSheet(true)
  }

  const toggleGroup = (sender: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(sender)) {
      newExpanded.delete(sender)
    } else {
      newExpanded.add(sender)
    }
    setExpandedGroups(newExpanded)
  }

  const handleImportEmails = async () => {
    setIsImporting(true)
    try {
      const response = await fetch('/api/email/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: importLimit,
          daysBack: importDays
        }),
      })

      const result = await response.json()

      if (response.ok) {
        const message = `Imported ${result.imported} new emails${result.skipped > 0 ? `, skipped ${result.skipped} duplicates` : ''}${result.filtered > 0 ? `, filtered ${result.filtered} junk emails` : ''}`
        toast.success(message)
        setShowImportDialog(false)
        refetch()
      } else {
        toast.error(`Failed to import emails: ${result.error}`)
      }
    } catch (error) {
      toast.error('Failed to import emails')
    } finally {
      setIsImporting(false)
    }
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Untriaged Email Intake</h1>
          <p className="text-muted-foreground">
            {emails?.length || 0} new emails awaiting triage
          </p>
        </div>
        <Button
          onClick={() => setShowImportDialog(true)}
          variant="outline"
          className="gap-2"
        >
          <Mail className="h-4 w-4" />
          Import Emails
        </Button>
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
          {emailGroups.map((group) => (
            <Card key={group.sender} className="hover:shadow-md transition-shadow">
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
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{group.sender}</p>
                          {group.count > 1 && (
                            <Badge variant="outline" className="text-xs">
                              {group.count} emails
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {group.latestEmail.received_at && formatDistanceToNow(new Date(group.latestEmail.received_at), { addSuffix: true })}
                        </p>
                      </div>
                      {group.latestEmail.received_at && new Date().getTime() - new Date(group.latestEmail.received_at).getTime() < 3600000 && (
                        <Badge variant="secondary" className="text-xs">New</Badge>
                      )}
                    </div>

                    {/* Latest Email Preview */}
                    <div className="mt-2 cursor-pointer" onClick={() => openEmailDetail(group.latestEmail)}>
                      <p className="text-sm font-medium hover:text-[#9C27B0] transition-colors">
                        {group.latestEmail.subject || '(no subject)'}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {group.latestEmail.body_preview}
                      </p>
                    </div>

                    {/* Show older emails if grouped */}
                    {group.count > 1 && (
                      <Collapsible open={expandedGroups.has(group.sender)}>
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 text-xs"
                            onClick={() => toggleGroup(group.sender)}
                          >
                            {expandedGroups.has(group.sender) ? (
                              <>
                                <ChevronUp className="h-3 w-3 mr-1" />
                                Hide older emails
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3 mr-1" />
                                Show {group.count - 1} older email{group.count - 1 > 1 ? 's' : ''}
                              </>
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 mt-2">
                          {group.emails.slice(1).map((email) => (
                            <div
                              key={email.id}
                              className="pl-4 border-l-2 border-muted cursor-pointer hover:border-[#9C27B0] transition-colors"
                              onClick={() => openEmailDetail(email)}
                            >
                              <p className="text-sm font-medium">{email.subject || '(no subject)'}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1">{email.body_preview}</p>
                              <p className="text-xs text-muted-foreground">
                                {email.received_at && formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}
                              </p>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        className="gap-1"
                        onClick={() => openCreateLeadDialog(group.latestEmail)}
                      >
                        <User className="h-3 w-3" />
                        Create Lead
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-1"
                        onClick={() => handleFlagSupport(group.latestEmail.id)}
                      >
                        <Flag className="h-3 w-3" />
                        Flag Support
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleArchive(group.latestEmail.id)}
                      >
                        <Archive className="h-3 w-3" />
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

      {/* Email Detail Sheet */}
      <Sheet open={showEmailDetailSheet} onOpenChange={setShowEmailDetailSheet}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          {selectedEmail && (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <SheetTitle>{selectedEmail.subject || '(no subject)'}</SheetTitle>
                    <SheetDescription>
                      Conversation with {selectedEmail.from_email}
                    </SheetDescription>
                  </div>
                  <div className="flex gap-1 ml-4">
                    <Button
                      size="sm"
                      variant={viewMode === 'text' ? 'default' : 'outline'}
                      onClick={() => setViewMode('text')}
                      className="gap-1"
                    >
                      <FileText className="h-3 w-3" />
                      Text
                    </Button>
                    <Button
                      size="sm"
                      variant={viewMode === 'html' ? 'default' : 'outline'}
                      onClick={() => setViewMode('html')}
                      className="gap-1"
                    >
                      <Code className="h-3 w-3" />
                      HTML
                    </Button>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Thread of Emails */}
                {threadEmails && threadEmails.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      {threadEmails.length} message{threadEmails.length > 1 ? 's' : ''} in thread
                    </p>
                    {threadEmails.map((email, index) => (
                      <div
                        key={email.id}
                        className={`border rounded-lg p-4 ${
                          email.direction === 'outbound' ? 'bg-blue-50/50 border-blue-200' : 'bg-background'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                              email.direction === 'outbound' ? 'bg-blue-100' : 'bg-purple-100'
                            }`}>
                              <User className={`h-4 w-4 ${
                                email.direction === 'outbound' ? 'text-blue-600' : 'text-purple-600'
                              }`} />
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {email.direction === 'outbound' ? email.from_email : email.from_email}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {(email.sent_at || email.received_at) &&
                                  formatDistanceToNow(new Date(email.sent_at || email.received_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                          <Badge variant={email.direction === 'outbound' ? 'default' : 'secondary'}>
                            {email.direction === 'outbound' ? 'Sent' : 'Received'}
                          </Badge>
                        </div>

                        {/* Email Body */}
                        <div className="prose prose-sm max-w-none">
                          {viewMode === 'html' && email.body_html ? (
                            <div
                              className="text-sm border-t pt-3"
                              dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(email.body_html, {
                                  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'div', 'span'],
                                  ALLOWED_ATTR: ['href', 'target', 'style', 'class'],
                                })
                              }}
                            />
                          ) : (
                            <p className="text-sm whitespace-pre-wrap border-t pt-3">
                              {email.body_preview || 'No preview available'}
                            </p>
                          )}
                        </div>

                        {/* Attachments */}
                        {email.has_attachments && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              Has attachments
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`border rounded-lg p-4`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                          <User className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{selectedEmail.from_email}</p>
                          <p className="text-xs text-muted-foreground">
                            {selectedEmail.received_at &&
                              formatDistanceToNow(new Date(selectedEmail.received_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">Received</Badge>
                    </div>

                    {/* Email Body */}
                    <div className="prose prose-sm max-w-none">
                      {viewMode === 'html' && selectedEmail.body_html ? (
                        <div
                          className="text-sm border-t pt-3"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(selectedEmail.body_html, {
                              ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'div', 'span'],
                              ALLOWED_ATTR: ['href', 'target', 'style', 'class'],
                            })
                          }}
                        />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap border-t pt-3">
                          {selectedEmail.body_preview || 'No preview available'}
                        </p>
                      )}
                    </div>

                    {/* Attachments */}
                    {selectedEmail.has_attachments && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          Has attachments
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="border-t pt-4 space-y-3">
                  {!showReplyForm ? (
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        className="gap-1 flex-1"
                        onClick={() => setShowReplyForm(true)}
                      >
                        <Reply className="h-4 w-4" />
                        Reply
                      </Button>
                      <Button
                        variant="secondary"
                        className="gap-1 flex-1"
                        onClick={() => {
                          openCreateLeadDialog(selectedEmail)
                          setShowEmailDetailSheet(false)
                        }}
                      >
                        <User className="h-4 w-4" />
                        Create Lead
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium">Reply to {selectedEmail.from_email}</label>
                        <Textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type your reply..."
                          rows={6}
                          className="mt-2"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleReply}
                          disabled={!replyText.trim() || sendEmail.isPending}
                        >
                          {sendEmail.isPending ? 'Sending...' : 'Send Reply'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowReplyForm(false)
                            setReplyText('')
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => {
                        handleFlagSupport(selectedEmail.id)
                        setShowEmailDetailSheet(false)
                      }}
                    >
                      <Flag className="h-3 w-3" />
                      Flag Support
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        handleArchive(selectedEmail.id)
                        setShowEmailDetailSheet(false)
                      }}
                    >
                      <Archive className="h-3 w-3" />
                      Archive
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Import Emails Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Historical Emails</DialogTitle>
            <DialogDescription>
              Import emails from your mailbox. The system will automatically skip duplicates and filter out obvious junk emails.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Import from last</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={importDays}
                onChange={(e) => setImportDays(Number(e.target.value))}
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days (Recommended)</option>
                <option value={90}>90 days</option>
                <option value={180}>6 months</option>
                <option value={365}>1 year</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Only emails from the selected time period will be imported
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Maximum emails to import</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={importLimit}
                onChange={(e) => setImportLimit(Number(e.target.value))}
              >
                <option value={50}>50 emails</option>
                <option value={100}>100 emails (Recommended)</option>
                <option value={200}>200 emails</option>
                <option value={500}>500 emails</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Safety limit to prevent importing too many emails at once
              </p>
            </div>

            <div className="rounded-lg bg-muted p-3 space-y-1">
              <p className="text-sm font-medium">What will be filtered out:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Emails already in the system (duplicates)</li>
                <li>• Automated no-reply emails</li>
                <li>• System notifications</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleImportEmails} disabled={isImporting}>
              {isImporting ? 'Importing...' : 'Import Emails'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
