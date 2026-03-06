'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Loader2, Mail, X, Sparkles, MessageSquareReply } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { logger } from '@/lib/logger'

const log = logger('email-composer')

interface AlternativeContact {
  id: string
  full_name: string
  email: string
  role?: string
}

interface EmailComposerProps {
  trigger?: React.ReactNode
  recipientEmail: string
  recipientName?: string
  customerId?: string
  projectId?: string
  subject?: string
  alternativeContacts?: AlternativeContact[]
  onEmailSent?: () => void
}

export function EmailComposer({
  trigger,
  recipientEmail,
  recipientName,
  customerId,
  projectId,
  subject: initialSubject = '',
  alternativeContacts = [],
  onEmailSent
}: EmailComposerProps) {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState(initialSubject)
  const [body, setBody] = useState('')
  const [ccEmails, setCcEmails] = useState<string[]>([])
  const [isSending, setIsSending] = useState(false)
  const [isPolishing, setIsPolishing] = useState(false)
  const [isSuggesting, setIsSuggesting] = useState(false)

  const handleCcToggle = (email: string, checked: boolean) => {
    if (checked) {
      setCcEmails(prev => [...prev, email])
    } else {
      setCcEmails(prev => prev.filter(e => e !== email))
    }
  }

  const handlePolish = async () => {
    if (!body.trim()) {
      toast.error('Write a draft first, then polish it')
      return
    }
    setIsPolishing(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15_000)
      const response = await fetch('/api/email/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to polish email')
      }
      const { polished } = await response.json()
      setBody(polished)
      toast.success('Email polished in brand voice')
    } catch (error: any) {
      log.error('Polish error', { error })
      if (error.name === 'AbortError') {
        toast.error('AI is temporarily unavailable. Please try again in a moment.')
      } else {
        toast.error(error.message || 'Failed to polish email')
      }
    } finally {
      setIsPolishing(false)
    }
  }

  const handleSuggestReply = async () => {
    setIsSuggesting(true)
    try {
      const payload: Record<string, string> = {}
      if (projectId) payload.workItemId = projectId
      else if (customerId) payload.customerId = customerId
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15_000)
      const response = await fetch('/api/ai/suggest-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate suggested reply')
      }
      const { reply, subject: suggestedSubject } = await response.json()
      setBody(reply)
      if (suggestedSubject && !subject) setSubject(suggestedSubject)
      toast.success('AI reply loaded — review and edit before sending')
    } catch (error: any) {
      log.error('Suggest reply error', { error })
      if (error.name === 'AbortError') {
        toast.error('AI is temporarily unavailable. Please try again in a moment.')
      } else {
        toast.error(error.message || 'Failed to generate suggestion')
      }
    } finally {
      setIsSuggesting(false)
    }
  }

  const handleSend = async () => {
    if (!subject.trim()) {
      toast.error('Please enter a subject')
      return
    }

    if (!body.trim()) {
      toast.error('Please enter a message')
      return
    }

    setIsSending(true)

    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: recipientEmail,
          cc: ccEmails.length > 0 ? ccEmails : undefined,
          subject,
          body,
          customerId,
          projectId
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send email')
      }

      toast.success('Email sent successfully')
      setOpen(false)

      // Reset form
      setSubject('')
      setBody('')
      setCcEmails([])

      // Call callback if provided
      if (onEmailSent) {
        onEmailSent()
      }

    } catch (error: any) {
      log.error('Send email error', { error })
      toast.error(error.message || 'Failed to send email')
    } finally {
      setIsSending(false)
    }
  }

  const handleCancel = () => {
    setOpen(false)
    // Reset form after animation
    setTimeout(() => {
      setSubject(initialSubject)
      setBody('')
      setCcEmails([])
    }, 300)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Mail className="mr-2 h-4 w-4" />
            Email Customer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Email</DialogTitle>
          <DialogDescription>
            Compose and send an email to {recipientName || recipientEmail}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* To */}
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{recipientName || recipientEmail}</div>
                {recipientName && (
                  <div className="text-xs text-muted-foreground truncate">{recipientEmail}</div>
                )}
              </div>
            </div>
          </div>

          {/* CC Alternative Contacts */}
          {alternativeContacts.length > 0 && (
            <div className="space-y-2">
              <Label>CC (Optional)</Label>
              <div className="space-y-2 p-3 border rounded-md">
                {alternativeContacts.map((contact) => (
                  <div key={contact.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`cc-${contact.id}`}
                      checked={ccEmails.includes(contact.email)}
                      onCheckedChange={(checked) => handleCcToggle(contact.email, checked as boolean)}
                    />
                    <label
                      htmlFor={`cc-${contact.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span>{contact.full_name}</span>
                        {contact.role && (
                          <Badge variant="outline" className="text-xs">
                            {contact.role}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{contact.email}</div>
                    </label>
                  </div>
                ))}
              </div>
              {ccEmails.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {ccEmails.length} {ccEmails.length === 1 ? 'person' : 'people'} will be CC'd
                </div>
              )}
            </div>
          )}

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              placeholder="Enter email subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="body">Message *</Label>
            <Textarea
              id="body"
              placeholder="Type your message here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="resize-none"
            />
            <div className="text-xs text-muted-foreground">
              {body.length} characters
            </div>
          </div>

          {/* Future: Attachments */}
          {/* <div className="space-y-2">
            <Label>Attachments</Label>
            <Button variant="outline" size="sm" className="gap-2">
              <Paperclip className="h-4 w-4" />
              Attach Files
            </Button>
          </div> */}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isSending || isPolishing || isSuggesting}>
            Cancel
          </Button>
          {(customerId || projectId) && (
            <Button
              variant="outline"
              onClick={handleSuggestReply}
              disabled={isSending || isPolishing || isSuggesting}
            >
              {isSuggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareReply className="mr-2 h-4 w-4" />}
              {isSuggesting ? 'Generating...' : 'Suggest Reply'}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handlePolish}
            disabled={!body.trim() || isSending || isPolishing || isSuggesting}
          >
            {isPolishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {isPolishing ? 'Polishing...' : 'Polish'}
          </Button>
          <Button onClick={handleSend} disabled={isSending || isPolishing || isSuggesting}>
            {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
