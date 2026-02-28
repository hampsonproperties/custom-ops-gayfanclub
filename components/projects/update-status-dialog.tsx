'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { StatusBadge } from '@/components/custom/status-badge'

const STATUS_OPTIONS = [
  { value: 'new_inquiry', label: 'New Inquiry', description: 'Initial customer inquiry' },
  { value: 'awaiting_approval', label: 'Awaiting Approval', description: 'Waiting for customer approval' },
  { value: 'approved', label: 'Approved', description: 'Customer has approved' },
  { value: 'in_design', label: 'In Design', description: 'Design work in progress' },
  { value: 'awaiting_design_approval', label: 'Awaiting Design Approval', description: 'Design needs customer approval' },
  { value: 'design_approved', label: 'Design Approved', description: 'Design has been approved' },
  { value: 'in_production', label: 'In Production', description: 'Currently being manufactured' },
  { value: 'quality_check', label: 'Quality Check', description: 'Undergoing quality inspection' },
  { value: 'ready_to_ship', label: 'Ready to Ship', description: 'Packaged and ready for shipment' },
  { value: 'shipped', label: 'Shipped', description: 'Order has been shipped' },
  { value: 'delivered', label: 'Delivered', description: 'Order delivered to customer' },
  { value: 'completed', label: 'Completed', description: 'Project completed' },
  { value: 'on_hold', label: 'On Hold', description: 'Temporarily paused' },
  { value: 'cancelled', label: 'Cancelled', description: 'Project cancelled' },
] as const

interface UpdateStatusDialogProps {
  projectId: string
  currentStatus: string
  trigger?: React.ReactNode
  onStatusUpdated?: () => void
}

export function UpdateStatusDialog({
  projectId,
  currentStatus,
  trigger,
  onStatusUpdated
}: UpdateStatusDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [newStatus, setNewStatus] = useState(currentStatus)
  const [note, setNote] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  const handleUpdate = async () => {
    if (newStatus === currentStatus) {
      toast.error('Please select a different status')
      return
    }

    setIsUpdating(true)

    try {
      const response = await fetch(`/api/projects/${projectId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          note: note.trim() || undefined
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update status')
      }

      toast.success('Status updated successfully')
      setOpen(false)
      setNote('')

      // Call callback if provided
      if (onStatusUpdated) {
        onStatusUpdated()
      }

      // Refresh the page
      router.refresh()

    } catch (error: any) {
      console.error('Status update error:', error)
      toast.error(error.message || 'Failed to update status')
    } finally {
      setIsUpdating(false)
    }
  }

  const currentStatusLabel = STATUS_OPTIONS.find(s => s.value === currentStatus)?.label || currentStatus
  const newStatusInfo = STATUS_OPTIONS.find(s => s.value === newStatus)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            Update Status
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update Project Status</DialogTitle>
          <DialogDescription>
            Change the current status of this project and optionally add a note.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Status */}
          <div className="space-y-2">
            <Label>Current Status</Label>
            <div>
              <StatusBadge status={currentStatus} />
            </div>
          </div>

          {/* New Status */}
          <div className="space-y-2">
            <Label htmlFor="status">New Status</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{status.label}</span>
                      <span className="text-xs text-muted-foreground">{status.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {newStatusInfo && newStatus !== currentStatus && (
              <p className="text-xs text-muted-foreground">
                {newStatusInfo.description}
              </p>
            )}
          </div>

          {/* Optional Note */}
          <div className="space-y-2">
            <Label htmlFor="note">Note (Optional)</Label>
            <Textarea
              id="note"
              placeholder="Add a note about this status change..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This note will be added to the project activity timeline.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isUpdating}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={isUpdating || newStatus === currentStatus}>
            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
