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
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Calendar, UserCheck } from 'lucide-react'

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

// Suggest a follow-up period based on close reason
const FOLLOW_UP_SUGGESTIONS: Record<string, { label: string; days: number } | null> = {
  missed_deadline: { label: '2 weeks', days: 14 },
  too_expensive: { label: '3 months', days: 90 },
  ghosted: { label: '1 month', days: 30 },
  went_with_competitor: { label: '3 months', days: 90 },
  not_ready_yet: { label: '1 month', days: 30 },
  cancelled: { label: '2 months', days: 60 },
  won: null,
  spam: null,
  other: null,
}

// Win-back cadence: multi-touch follow-up schedules per close reason
// Each array entry is the number of days from NOW for that touch
export const WIN_BACK_CADENCES: Record<string, number[] | null> = {
  missed_deadline: [14, 30, 90],
  too_expensive: [60, 90],
  ghosted: [30, 60],
  went_with_competitor: [90],
  not_ready_yet: [30, 60, 90],
  cancelled: [60, 120],
  won: null,
  spam: null,
  other: null,
}

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
  const [step, setStep] = useState<'reason' | 'follow-up'>('reason')
  const closeWorkItem = useCloseWorkItem()
  const router = useRouter()
  const queryClient = useQueryClient()

  const handleClose = async () => {
    try {
      await closeWorkItem.mutateAsync({ workItemId, reason, customerId: customerId || undefined })
      toast.success('Lead closed successfully')

      const suggestion = FOLLOW_UP_SUGGESTIONS[reason]
      if (suggestion && customerId) {
        setStep('follow-up')
      } else {
        onOpenChange(false)
        if (customerId) {
          router.push(`/customers/${customerId}?tab=activity`)
        } else {
          router.push('/follow-ups')
        }
      }
    } catch (error) {
      toast.error('Failed to close lead')
    }
  }

  const handleSetFollowUp = async (days: number) => {
    if (!customerId) return
    const supabase = createClient()

    // Determine win-back cadence info
    const cadence = WIN_BACK_CADENCES[reason]
    const isWinBack = cadence && cadence.length > 0

    await supabase
      .from('customers')
      .update({
        next_follow_up_at: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
        follow_up_reason: isWinBack ? 'win-back' : 'manual',
        follow_up_touch_number: isWinBack ? 1 : null,
        follow_up_max_touches: isWinBack ? cadence.length : null,
      })
      .eq('id', customerId)

    const touchInfo = isWinBack ? ` (win-back touch 1 of ${cadence.length})` : ''
    toast.success(`Follow-up set for ${days} days from now${touchInfo}`)
    queryClient.invalidateQueries({ queryKey: ['morning-briefing'] })
    queryClient.invalidateQueries({ queryKey: ['customer-profile', customerId] })
    onOpenChange(false)
    setStep('reason')
    router.push(`/customers/${customerId}?tab=activity`)
  }

  const handleSkipFollowUp = () => {
    onOpenChange(false)
    setStep('reason')
    if (customerId) {
      router.push(`/customers/${customerId}?tab=activity`)
    } else {
      router.push('/follow-ups')
    }
  }

  const suggestion = FOLLOW_UP_SUGGESTIONS[reason]
  const cadence = WIN_BACK_CADENCES[reason]

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { onOpenChange(open); if (!open) setStep('reason') }}>
      <DialogContent>
        {step === 'reason' ? (
          <>
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
                          <span className="text-muted-foreground ml-2 text-xs">&mdash; {r.description}</span>
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
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-blue-600" />
                Set a follow-up reminder?
              </DialogTitle>
              <DialogDescription>
                This customer was closed as &ldquo;{CLOSE_REASONS.find(r => r.value === reason)?.label}&rdquo;.
                {cadence && cadence.length > 1
                  ? ` The system will auto-schedule ${cadence.length} check-in touches.`
                  : ' Want to check back in later?'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-2">
              {suggestion && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 h-10"
                  onClick={() => handleSetFollowUp(suggestion.days)}
                >
                  <Calendar className="h-4 w-4 text-blue-600" />
                  Follow up in {suggestion.label} (recommended)
                  {cadence && cadence.length > 1 && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {cadence.length} touches
                    </span>
                  )}
                </Button>
              )}
              {[
                { label: '1 week', days: 7 },
                { label: '2 weeks', days: 14 },
                { label: '1 month', days: 30 },
                { label: '3 months', days: 90 },
                { label: '6 months', days: 180 },
              ].filter(opt => !suggestion || opt.days !== suggestion.days).map((opt) => (
                <Button
                  key={opt.days}
                  variant="ghost"
                  className="w-full justify-start gap-2 h-9 text-sm"
                  onClick={() => handleSetFollowUp(opt.days)}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Follow up in {opt.label}
                </Button>
              ))}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={handleSkipFollowUp}>
                Skip — go to customer
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
