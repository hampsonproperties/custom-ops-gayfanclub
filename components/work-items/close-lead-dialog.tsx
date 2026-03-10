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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCloseWorkItem } from '@/lib/hooks/use-work-items'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export type CloseReason =
  | 'won'
  | 'missed_deadline'
  | 'too_expensive'
  | 'ghosted'
  | 'went_with_competitor'
  | 'not_ready_yet'
  | 'spam'
  | 'cancelled'
  | 'other'

const CLOSE_REASONS: { value: CloseReason; label: string; description: string }[] = [
  { value: 'won', label: 'Won', description: 'Successfully completed or fulfilled' },
  { value: 'missed_deadline', label: 'Missed deadline', description: "Couldn't meet their timeline" },
  { value: 'too_expensive', label: 'Too expensive', description: 'Price was out of their budget' },
  { value: 'ghosted', label: 'Ghosted', description: 'Customer stopped responding' },
  { value: 'went_with_competitor', label: 'Went with competitor', description: 'Chose another vendor' },
  { value: 'not_ready_yet', label: 'Not ready yet', description: 'Interested but not ready to proceed' },
  { value: 'cancelled', label: 'Event cancelled', description: 'Their event was cancelled or postponed' },
  { value: 'spam', label: 'Spam / Not a real lead', description: 'Vendor pitch, junk, or irrelevant' },
  { value: 'other', label: 'Other', description: 'Different reason' },
]

interface CloseLeadDialogProps {
  workItemId: string
  workItemName: string
  customerId?: string | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function CloseLeadDialog({
  workItemId,
  workItemName,
  customerId,
  isOpen,
  onOpenChange,
}: CloseLeadDialogProps) {
  const [reason, setReason] = useState<CloseReason>('ghosted')
  const closeWorkItem = useCloseWorkItem()
  const router = useRouter()

  const handleClose = async () => {
    try {
      await closeWorkItem.mutateAsync({ workItemId, reason, customerId: customerId || undefined })
      toast.success('Lead closed successfully')
      onOpenChange(false)

      // Redirect to leads page after closing
      router.push('/follow-ups')
    } catch (error) {
      toast.error('Failed to close lead')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close Lead</DialogTitle>
          <DialogDescription>
            Close &ldquo;{workItemName}&rdquo; and archive it. This won&apos;t delete the record.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Why are you closing this?</Label>
            <Select value={reason} onValueChange={(value) => setReason(value as CloseReason)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLOSE_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    <div>
                      <span className="font-medium">{r.label}</span>
                      <span className="text-muted-foreground ml-2 text-xs">— {r.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleClose} disabled={closeWorkItem.isPending}>
            {closeWorkItem.isPending ? 'Closing...' : 'Close Lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
