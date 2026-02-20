'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface BatchEmailStatus {
  work_item_id: string
  customer_name: string
  customer_email: string
  entering_production_status: string
  entering_production_scheduled: string | null
  entering_production_sent: string | null
  midway_checkin_status: string
  midway_checkin_scheduled: string | null
  midway_checkin_sent: string | null
  en_route_status: string
  en_route_scheduled: string | null
  en_route_sent: string | null
  arrived_stateside_status: string
  arrived_stateside_scheduled: string | null
  arrived_stateside_sent: string | null
}

/**
 * Fetch email send status for all work items in a batch
 */
export function useBatchEmailStatus(batchId: string) {
  return useQuery<{ batchId: string; emails: BatchEmailStatus[] }>({
    queryKey: ['batch-email-status', batchId],
    queryFn: async () => {
      const response = await fetch(`/api/batch-emails/status/${batchId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch batch email status')
      }
      return response.json()
    },
    enabled: !!batchId,
  })
}

/**
 * Cancel a pending batch email
 */
export function useCancelBatchEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ queueId, reason }: { queueId: string; reason?: string }) => {
      const response = await fetch('/api/batch-emails/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId, reason }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to cancel email')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate all batch email status queries
      queryClient.invalidateQueries({ queryKey: ['batch-email-status'] })
    },
  })
}

/**
 * Manually queue a batch email (for testing or resends)
 */
export function useQueueBatchEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      batchId,
      workItemId,
      emailType,
      recipientEmail,
      recipientName,
      scheduledSendAt,
      expectedBatchStatus,
      expectedHasTracking,
    }: {
      batchId: string
      workItemId: string
      emailType: 'entering_production' | 'midway_checkin' | 'en_route' | 'arrived_stateside'
      recipientEmail: string
      recipientName?: string
      scheduledSendAt: Date
      expectedBatchStatus?: string
      expectedHasTracking?: boolean
    }) => {
      const response = await fetch('/api/batch-emails/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId,
          workItemId,
          emailType,
          recipientEmail,
          recipientName,
          scheduledSendAt: scheduledSendAt.toISOString(),
          expectedBatchStatus,
          expectedHasTracking,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to queue email')
      }

      return response.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['batch-email-status', variables.batchId] })
    },
  })
}
