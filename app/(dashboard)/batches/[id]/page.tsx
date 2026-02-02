'use client'

import { use } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, FileDown, CheckCircle, Package } from 'lucide-react'
import { useBatch, useConfirmBatch, useExportBatch } from '@/lib/hooks/use-batches'
import { StatusBadge } from '@/components/custom/status-badge'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

export default function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: batch, isLoading } = useBatch(id)
  const confirmBatch = useConfirmBatch()
  const exportBatch = useExportBatch()

  const handleConfirm = async () => {
    try {
      await confirmBatch.mutateAsync(id)
      toast.success('Batch confirmed')
    } catch (error) {
      toast.error('Failed to confirm batch')
    }
  }

  const handleExport = async () => {
    try {
      // Export batch data as CSV
      const response = await fetch(`/api/batches/${id}/export`)
      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${batch?.name || 'batch'}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      // Mark batch as exported
      await exportBatch.mutateAsync(id)
      toast.success('Batch exported successfully')
    } catch (error) {
      toast.error('Failed to export batch')
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <p>Loading batch...</p>
      </div>
    )
  }

  if (!batch) {
    return (
      <div className="p-6">
        <p>Batch not found</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/batches">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>

        <div className="flex-1">
          <h1 className="text-3xl font-bold">{batch.name}</h1>
          <p className="text-muted-foreground">
            Created {formatDistanceToNow(new Date(batch.created_at), { addSuffix: true })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={batch.status} />
          {batch.status === 'draft' && (
            <Button
              onClick={handleConfirm}
              disabled={confirmBatch.isPending}
              className="gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Confirm Batch
            </Button>
          )}
          {batch.status === 'confirmed' && (
            <Button
              onClick={handleExport}
              disabled={exportBatch.isPending}
              className="gap-2"
            >
              <FileDown className="h-4 w-4" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Batch Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Batch Items ({batch.items?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!batch.items || batch.items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No items in this batch
            </p>
          ) : (
            <div className="space-y-2">
              {batch.items.map((item: any) => {
                const workItem = item.work_item
                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex-1">
                      <Link
                        href={`/work-items/${workItem.id}`}
                        className="font-medium hover:underline"
                      >
                        {workItem.customer_name || workItem.customer_email}
                      </Link>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{workItem.quantity || 0} units</span>
                        <span>•</span>
                        <span>{workItem.grip_color || 'No color'}</span>
                        <span>•</span>
                        <span>{workItem.shopify_order_number || 'No order'}</span>
                      </div>
                    </div>
                    <StatusBadge status={workItem.status} />
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <span className="text-sm text-muted-foreground">Total Items</span>
              <p className="font-medium text-2xl">{batch.items?.length || 0}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Total Units</span>
              <p className="font-medium text-2xl">
                {batch.items?.reduce((sum: number, item: any) => sum + (item.work_item?.quantity || 0), 0) || 0}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="mt-2">
                <StatusBadge status={batch.status} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
