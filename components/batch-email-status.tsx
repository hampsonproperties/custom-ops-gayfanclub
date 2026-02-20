'use client'

import { useBatchEmailStatus, useCancelBatchEmail } from '@/lib/hooks/use-batch-emails'
import { useMarkBatchReceived } from '@/lib/hooks/use-batches'
import { format } from 'date-fns'
import { CheckCircle2, Clock, XCircle, Circle, Loader2 } from 'lucide-react'

interface BatchEmailStatusProps {
  batchId: string
}

export function BatchEmailStatus({ batchId }: BatchEmailStatusProps) {
  const { data, isLoading } = useBatchEmailStatus(batchId)
  const cancelEmail = useCancelBatchEmail()
  const markReceived = useMarkBatchReceived()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!data || data.emails.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No email status available for this batch
      </div>
    )
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-600" />
      case 'cancelled':
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />
      default:
        return <Circle className="h-5 w-5 text-gray-300" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'sent':
        return 'Sent'
      case 'pending':
        return 'Scheduled'
      case 'cancelled':
        return 'Cancelled'
      case 'failed':
        return 'Failed'
      case 'not_queued':
        return 'Not Queued'
      default:
        return status
    }
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return null
    try {
      return format(new Date(dateString), 'MMM d, h:mm a')
    } catch {
      return dateString
    }
  }

  const handleMarkReceived = async () => {
    if (confirm('Mark this batch as received at warehouse? This will queue the final email to all customers.')) {
      try {
        await markReceived.mutateAsync({ batchId })
      } catch (error) {
        console.error('Failed to mark batch as received:', error)
        alert('Failed to mark batch as received. Please try again.')
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Batch Email Status</h3>
        <button
          onClick={handleMarkReceived}
          disabled={markReceived.isPending}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {markReceived.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Mark Batch as Received
        </button>
      </div>

      <div className="space-y-6">
        {data.emails.map((emailStatus) => (
          <div key={emailStatus.work_item_id} className="border border-gray-200 rounded-lg p-4">
            <div className="mb-4">
              <h4 className="font-medium text-gray-900">{emailStatus.customer_name || 'Unknown Customer'}</h4>
              <p className="text-sm text-gray-500">{emailStatus.customer_email}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Email 1: Entering Production */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(emailStatus.entering_production_status)}
                  <span className="font-medium text-sm">Entering Production</span>
                </div>
                <div className="text-xs text-gray-600 pl-7">
                  <div>{getStatusLabel(emailStatus.entering_production_status)}</div>
                  {emailStatus.entering_production_scheduled && (
                    <div className="text-gray-500">
                      Scheduled: {formatDateTime(emailStatus.entering_production_scheduled)}
                    </div>
                  )}
                  {emailStatus.entering_production_sent && (
                    <div className="text-green-600">
                      Sent: {formatDateTime(emailStatus.entering_production_sent)}
                    </div>
                  )}
                </div>
              </div>

              {/* Email 2: Midway Check-In */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(emailStatus.midway_checkin_status)}
                  <span className="font-medium text-sm">Midway Check-In</span>
                </div>
                <div className="text-xs text-gray-600 pl-7">
                  <div>{getStatusLabel(emailStatus.midway_checkin_status)}</div>
                  {emailStatus.midway_checkin_scheduled && (
                    <div className="text-gray-500">
                      Scheduled: {formatDateTime(emailStatus.midway_checkin_scheduled)}
                    </div>
                  )}
                  {emailStatus.midway_checkin_sent && (
                    <div className="text-green-600">
                      Sent: {formatDateTime(emailStatus.midway_checkin_sent)}
                    </div>
                  )}
                </div>
              </div>

              {/* Email 3: En Route */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(emailStatus.en_route_status)}
                  <span className="font-medium text-sm">En Route</span>
                </div>
                <div className="text-xs text-gray-600 pl-7">
                  <div>{getStatusLabel(emailStatus.en_route_status)}</div>
                  {emailStatus.en_route_scheduled && (
                    <div className="text-gray-500">
                      Scheduled: {formatDateTime(emailStatus.en_route_scheduled)}
                    </div>
                  )}
                  {emailStatus.en_route_sent && (
                    <div className="text-green-600">Sent: {formatDateTime(emailStatus.en_route_sent)}</div>
                  )}
                </div>
              </div>

              {/* Email 4: Arrived Stateside */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(emailStatus.arrived_stateside_status)}
                  <span className="font-medium text-sm">Arrived Stateside</span>
                </div>
                <div className="text-xs text-gray-600 pl-7">
                  <div>{getStatusLabel(emailStatus.arrived_stateside_status)}</div>
                  {emailStatus.arrived_stateside_scheduled && (
                    <div className="text-gray-500">
                      Scheduled: {formatDateTime(emailStatus.arrived_stateside_scheduled)}
                    </div>
                  )}
                  {emailStatus.arrived_stateside_sent && (
                    <div className="text-green-600">
                      Sent: {formatDateTime(emailStatus.arrived_stateside_sent)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
