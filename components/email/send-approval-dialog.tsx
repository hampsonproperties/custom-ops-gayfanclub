'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useFiles } from '@/lib/hooks/use-files'
import { toast } from 'sonner'
import { FileIcon, CheckCircle2 } from 'lucide-react'
import type { Database } from '@/types/database'

type FileRecord = Database['public']['Tables']['files']['Row']
type WorkItem = Database['public']['Tables']['work_items']['Row']

interface SendApprovalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workItem: WorkItem
  onSuccess?: () => void
}

export function SendApprovalDialog({
  open,
  onOpenChange,
  workItem,
  onSuccess,
}: SendApprovalDialogProps) {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const { data: files = [], isLoading: loadingFiles } = useFiles(workItem.id)

  // Filter for proof files only
  const proofFiles = files.filter((f) => f.kind === 'proof')

  const handleSend = async () => {
    if (!selectedFileId) {
      toast.error('Please select a proof file to send')
      return
    }

    setSending(true)

    try {
      const response = await fetch('/api/send-approval-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workItemId: workItem.id,
          fileId: selectedFileId,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send approval email')
      }

      toast.success('Approval email sent successfully!')
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Failed to send approval email:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to send approval email'
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send Approval Email</DialogTitle>
          <DialogDescription>
            Select a proof file to send to {workItem.customer_name || 'the customer'} for
            approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-1">
            <div className="text-sm">
              <span className="font-medium">Customer:</span>{' '}
              {workItem.customer_name || 'Unknown'}
            </div>
            <div className="text-sm">
              <span className="font-medium">Email:</span>{' '}
              {workItem.customer_email || 'No email on file'}
            </div>
            <div className="text-sm">
              <span className="font-medium">Order:</span>{' '}
              {workItem.shopify_order_number || workItem.id.slice(0, 8)}
            </div>
          </div>

          {/* File selector */}
          <div>
            <h4 className="text-sm font-medium mb-3">Select Proof File:</h4>

            {loadingFiles ? (
              <div className="text-sm text-muted-foreground">Loading files...</div>
            ) : proofFiles.length === 0 ? (
              <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-6 text-center">
                No proof files available. Please upload a proof file first.
              </div>
            ) : (
              <div className="space-y-2">
                {proofFiles.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => setSelectedFileId(file.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedFileId === file.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileIcon className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {file.original_filename}
                        </div>
                        {file.note && (
                          <div className="text-sm text-muted-foreground truncate">
                            {file.note}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          Version {file.version} •{' '}
                          {new Date(file.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      {selectedFileId === file.id && (
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Email preview info */}
          {selectedFileId && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Preview:</strong> The customer will receive an email with the
                proof image embedded and Approve/Request Changes buttons. They can click
                either button to respond instantly.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!selectedFileId || sending || !workItem.customer_email}
          >
            {sending ? 'Sending...' : 'Send Approval Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
