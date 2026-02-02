'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { FileAttachmentPicker } from './file-attachment-picker'
import { useSendEmail } from '@/lib/hooks/use-communications'
import { Send } from 'lucide-react'
import { toast } from 'sonner'
import type { Database } from '@/types/database'

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
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
  const [includeApprovalLink, setIncludeApprovalLink] = useState(false)

  const sendEmail = useSendEmail()

  const handleSend = async () => {
    if (!to || !subject || !body) {
      toast.error('Please fill in all fields')
      return
    }

    try {
      await sendEmail.mutateAsync({
        workItemId,
        to,
        subject,
        body,
        attachments: selectedFileIds,
        includeApprovalLink,
      })

      toast.success('Email sent successfully!')

      // Reset form
      setSubject('')
      setBody('')
      setSelectedFileIds([])
      setIncludeApprovalLink(false)

      onSendSuccess?.()
    } catch (error) {
      console.error('Failed to send email:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send email')
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-card">
      <div className="space-y-1">
        <h3 className="font-semibold text-lg">Compose New Email</h3>
        <p className="text-sm text-muted-foreground">
          Send an email with optional file attachments and approval links
        </p>
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
            rows={8}
            placeholder="Type your message here..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={sendEmail.isPending}
          />
        </div>

        {/* File Attachments */}
        <div className="space-y-2">
          <Label>Attachments</Label>
          <FileAttachmentPicker
            workItemId={workItemId}
            selectedFileIds={selectedFileIds}
            onSelectionChange={setSelectedFileIds}
          />
        </div>

        {/* Include Approval Link Checkbox */}
        {(workItem.type === 'assisted_project' ||
          workItem.type === 'customify_order') && (
          <div className="flex items-start space-x-2 p-3 bg-muted/50 rounded-lg">
            <Checkbox
              id="include-approval"
              checked={includeApprovalLink}
              onCheckedChange={(checked) =>
                setIncludeApprovalLink(checked === true)
              }
              disabled={sendEmail.isPending || selectedFileIds.length === 0}
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="include-approval"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Include proof approval links
              </label>
              <p className="text-xs text-muted-foreground">
                {selectedFileIds.length === 0
                  ? 'Attach a proof file to enable this option'
                  : 'Automatically generate approve/reject links for the first attached proof'}
              </p>
            </div>
          </div>
        )}

        {/* Send Button */}
        <div className="flex justify-end pt-2 border-t">
          <Button
            onClick={handleSend}
            disabled={!to || !subject || !body || sendEmail.isPending}
          >
            <Send className="h-4 w-4 mr-2" />
            {sendEmail.isPending ? 'Sending...' : 'Send Email'}
          </Button>
        </div>
      </div>
    </div>
  )
}
