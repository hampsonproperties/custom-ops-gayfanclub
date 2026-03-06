'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TemplateSelector } from './template-selector'
import { useSendEmail } from '@/lib/hooks/use-communications'
import { Send, Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Database } from '@/types/database'
import type { SelectedTemplate } from './template-selector'
import { logger } from '@/lib/logger'

const log = logger('inline-email-composer')

type WorkItem = Database['public']['Tables']['work_items']['Row']

interface InlineEmailComposerProps {
  workItemId: string
  workItem: WorkItem
  defaultTo?: string
  defaultSubject?: string
  onSendSuccess?: () => void
}

export function InlineEmailComposer({
  workItemId,
  workItem,
  defaultTo = '',
  defaultSubject = '',
  onSendSuccess,
}: InlineEmailComposerProps) {
  const [to, setTo] = useState(defaultTo || workItem.customer_email || '')
  const [subject, setSubject] = useState(defaultSubject)
  const [body, setBody] = useState('')

  const [isPolishing, setIsPolishing] = useState(false)
  const sendEmail = useSendEmail()

  const handlePolish = async () => {
    if (!body.trim()) {
      toast.error('Write a draft first, then polish it')
      return
    }
    setIsPolishing(true)
    try {
      const response = await fetch('/api/email/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to polish email')
      }
      const { polished } = await response.json()
      setBody(polished)
      toast.success('Email polished in brand voice')
    } catch (error) {
      log.error('Polish error', { error })
      toast.error(error instanceof Error ? error.message : 'Failed to polish email')
    } finally {
      setIsPolishing(false)
    }
  }

  const handleSelectTemplate = (template: SelectedTemplate) => {
    setSubject(template.subject)
    setBody(template.body)
    toast.success(`Template "${template.name}" applied`, {
      description: 'You can now customize the message before sending',
    })
  }

  const handleSend = async () => {
    if (!to || !subject || !body) {
      toast.error('Please fill in all fields')
      return
    }

    try {
      await sendEmail.mutateAsync({
        projectId: workItemId,
        to,
        subject,
        body,
      })

      toast.success('Email sent successfully!')

      // Reset form
      setSubject('')
      setBody('')

      onSendSuccess?.()
    } catch (error) {
      log.error('Failed to send email', { error })
      toast.error(error instanceof Error ? error.message : 'Failed to send email')
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-card">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h3 className="font-semibold text-base sm:text-lg">Compose New Email</h3>
          <p className="text-sm text-muted-foreground">
            Send an email to {workItem.customer_name || workItem.customer_email || 'the customer'}
          </p>
        </div>
        <TemplateSelector onSelectTemplate={handleSelectTemplate} />
      </div>

      <div className="space-y-4">
        {/* To Field */}
        <div className="space-y-2">
          <Label htmlFor="compose-to">To</Label>
          <Input
            id="compose-to"
            type="email"
            placeholder="customer@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            disabled={sendEmail.isPending}
          />
        </div>

        {/* Subject Field */}
        <div className="space-y-2">
          <Label htmlFor="compose-subject">Subject</Label>
          <Input
            id="compose-subject"
            placeholder="Email subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={sendEmail.isPending}
          />
        </div>

        {/* Body Field */}
        <div className="space-y-2">
          <Label htmlFor="compose-body">Message</Label>
          <Textarea
            id="compose-body"
            rows={5}
            placeholder="Type your message here..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={sendEmail.isPending}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button
            variant="outline"
            onClick={handlePolish}
            disabled={!body.trim() || sendEmail.isPending || isPolishing}
          >
            {isPolishing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {isPolishing ? 'Polishing...' : 'Polish'}
          </Button>
          <Button
            onClick={handleSend}
            disabled={!to || !subject || !body || sendEmail.isPending || isPolishing}
          >
            <Send className="h-4 w-4 mr-2" />
            {sendEmail.isPending ? 'Sending...' : 'Send Email'}
          </Button>
        </div>
      </div>
    </div>
  )
}
