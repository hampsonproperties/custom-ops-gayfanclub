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

interface CloseLeadDialogProps {
  workItemId: string
  workItemName: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function CloseLeadDialog({
  workItemId,
  workItemName,
  isOpen,
  onOpenChange,
}: CloseLeadDialogProps) {
  const [reason, setReason] = useState<'not_interested' | 'spam' | 'cancelled' | 'completed' | 'other'>('not_interested')
  const closeWorkItem = useCloseWorkItem()
  const router = useRouter()

  const handleClose = async () => {
    try {
      await closeWorkItem.mutateAsync({ workItemId, reason })
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
            Close "{workItemName}" and remove it from your leads list. This won't delete the record, just archive it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason for closing</Label>
            <Select value={reason} onValueChange={(value) => setReason(value as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_interested">
                  Not interested - Customer declined or not pursuing
                </SelectItem>
                <SelectItem value="spam">
                  Spam - Sales pitch, vendor solicitation, junk
                </SelectItem>
                <SelectItem value="cancelled">
                  Cancelled - Event cancelled or project dropped
                </SelectItem>
                <SelectItem value="completed">
                  Completed - Already fulfilled elsewhere
                </SelectItem>
                <SelectItem value="other">
                  Other reason
                </SelectItem>
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
