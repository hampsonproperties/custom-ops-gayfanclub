'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSnoozeFollowUp } from '@/lib/hooks/use-work-items'
import { toast } from 'sonner'
import { Calendar, Clock } from 'lucide-react'

interface SnoozeDialogProps {
  workItemId: string
  workItemName: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function SnoozeDialog({
  workItemId,
  workItemName,
  isOpen,
  onOpenChange,
}: SnoozeDialogProps) {
  const [selectedDays, setSelectedDays] = useState<number | null>(null)
  const [customDays, setCustomDays] = useState('')
  const snoozeFollowUp = useSnoozeFollowUp()

  const presetOptions = [
    { label: '1 day', days: 1 },
    { label: '3 days', days: 3 },
    { label: '7 days', days: 7 },
  ]

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedDays(null)
      setCustomDays('')
    }
  }, [isOpen])

  const handlePresetClick = (days: number) => {
    setSelectedDays(days)
    setCustomDays('')
  }

  const handleCustomChange = (value: string) => {
    setCustomDays(value)
    const numDays = parseInt(value)
    if (!isNaN(numDays) && numDays > 0) {
      setSelectedDays(numDays)
    } else {
      setSelectedDays(null)
    }
  }

  const getPreviewDate = () => {
    if (!selectedDays) return null
    const date = new Date()
    date.setDate(date.getDate() + selectedDays)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const handleSubmit = async () => {
    if (!selectedDays || selectedDays <= 0) {
      toast.error('Please select a valid number of days')
      return
    }

    try {
      await snoozeFollowUp.mutateAsync({
        workItemId,
        days: selectedDays,
      })

      toast.success(
        `Follow-up snoozed for ${selectedDays} day${selectedDays === 1 ? '' : 's'}`
      )
      onOpenChange(false)
    } catch (error) {
      console.error('Snooze error:', error)
      toast.error('Failed to snooze follow-up')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Snooze Follow-Up</DialogTitle>
          <DialogDescription>
            Postpone the follow-up reminder for{' '}
            <span className="font-medium text-foreground">{workItemName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Preset options */}
          <div className="space-y-2">
            <Label>Quick Options</Label>
            <div className="grid grid-cols-3 gap-2">
              {presetOptions.map((option) => (
                <Button
                  key={option.days}
                  type="button"
                  variant={selectedDays === option.days ? 'default' : 'outline'}
                  onClick={() => handlePresetClick(option.days)}
                  className="w-full"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom days input */}
          <div className="space-y-2">
            <Label htmlFor="custom-days">Custom Days</Label>
            <Input
              id="custom-days"
              type="number"
              min="1"
              placeholder="Enter number of days"
              value={customDays}
              onChange={(e) => handleCustomChange(e.target.value)}
            />
          </div>

          {/* Preview */}
          {selectedDays && (
            <div className="flex items-center gap-2 rounded-md border border-muted bg-muted/50 p-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm">
                <div className="font-medium">Follow-up on</div>
                <div className="text-muted-foreground">{getPreviewDate()}</div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedDays || selectedDays <= 0 || snoozeFollowUp.isPending}
          >
            {snoozeFollowUp.isPending ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" />
                Snoozing...
              </>
            ) : (
              'Snooze'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
