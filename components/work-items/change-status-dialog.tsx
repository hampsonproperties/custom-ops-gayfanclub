'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/custom/status-badge'
import { useUpdateWorkItemStatus } from '@/lib/hooks/use-work-items'
import {
  getStatusGroups,
  analyzeTransition,
  getStatusLabel,
} from '@/lib/utils/status-transitions'
import type { Database } from '@/types/database'
import type { WorkItemStatus } from '@/types/database'
import { toast } from 'sonner'
import { AlertCircle } from 'lucide-react'

type WorkItem = Database['public']['Tables']['work_items']['Row']

interface ChangeStatusDialogProps {
  workItem: WorkItem
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function ChangeStatusDialog({
  workItem,
  isOpen,
  onOpenChange,
}: ChangeStatusDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<WorkItemStatus | ''>('')
  const [notes, setNotes] = useState('')
  const updateStatus = useUpdateWorkItemStatus()

  const statusGroups = getStatusGroups(workItem.type, workItem.status)

  // Analyze the transition whenever selected status changes
  const transitionAnalysis =
    selectedStatus && selectedStatus !== workItem.status
      ? analyzeTransition(workItem.status, selectedStatus, workItem.type)
      : null

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedStatus('')
      setNotes('')
    }
  }, [isOpen])

  const handleSubmit = async () => {
    if (!selectedStatus) {
      toast.error('Please select a status')
      return
    }

    // Validate notes requirement
    if (transitionAnalysis?.requiresNotes && !notes.trim()) {
      toast.error('Please add notes explaining this status change')
      return
    }

    try {
      await updateStatus.mutateAsync({
        id: workItem.id,
        status: selectedStatus,
        note: notes.trim() || undefined,
      })

      toast.success(`Status updated to ${getStatusLabel(selectedStatus)}`)
      onOpenChange(false)
    } catch (error) {
      toast.error('Failed to update status')
      console.error('Status update error:', error)
    }
  }

  const canSubmit =
    selectedStatus &&
    !transitionAnalysis?.isBlocked &&
    (!transitionAnalysis?.requiresNotes || notes.trim().length > 0) &&
    !updateStatus.isPending

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Change Work Item Status</DialogTitle>
          <DialogDescription>
            Update the status of this work item. All changes are tracked in the
            timeline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Status Display */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Current Status</label>
            <div>
              <StatusBadge status={workItem.status} />
            </div>
          </div>

          {/* New Status Selection */}
          <div className="space-y-2">
            <label htmlFor="status-select" className="text-sm font-medium">
              New Status
            </label>
            <select
              id="status-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as WorkItemStatus)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select a status...</option>
              {statusGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.statuses.map((status) => (
                    <option
                      key={status.value}
                      value={status.value}
                      disabled={status.disabled}
                    >
                      {status.label}
                      {status.value === workItem.status && ' (Current)'}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Only show validation and notes after a status is selected */}
          {selectedStatus && (
            <>
              {/* Warning/Error Messages */}
              {transitionAnalysis?.isBlocked && (
                <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-md flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-destructive">
                      Status Change Blocked
                    </p>
                    <p className="text-xs text-destructive/80 mt-1">
                      {transitionAnalysis.blockReason}
                    </p>
                  </div>
                </div>
              )}

              {transitionAnalysis?.warning && !transitionAnalysis.isBlocked && (
                <div className="bg-orange-50 border border-orange-200 p-3 rounded-md flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-orange-900">Warning</p>
                    <p className="text-xs text-orange-700 mt-1">
                      {transitionAnalysis.warning}
                    </p>
                  </div>
                </div>
              )}

              {/* Notes Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Notes
                  {transitionAnalysis?.requiresNotes && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    transitionAnalysis?.requiresNotes
                      ? 'Please explain why this status change is needed...'
                      : 'Optional notes about this status change...'
                  }
                  rows={4}
                />
              </div>

              {/* Info Message */}
              <div className="bg-muted p-3 rounded-md">
                <p className="text-xs text-muted-foreground">
                  This change will be logged in the timeline with your user account
                  and timestamp for full audit trail.
                </p>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateStatus.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {updateStatus.isPending ? 'Updating...' : 'Update Status'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
