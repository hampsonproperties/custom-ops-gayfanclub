'use client'

import { use, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, FileDown, CheckCircle, Package, Truck, ImageIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useBatch, useConfirmBatch, useExportBatch, useUpdateBatchTracking } from '@/lib/hooks/use-batches'
import { StatusBadge } from '@/components/custom/status-badge'
import { BatchEmailStatus } from '@/components/batch-email-status'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import Image from 'next/image'

export default function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: batch, isLoading } = useBatch(id)
  const confirmBatch = useConfirmBatch()
  const exportBatch = useExportBatch()
  const updateTracking = useUpdateBatchTracking()

  const [showTrackingDialog, setShowTrackingDialog] = useState(false)
  const [trackingNumber, setTrackingNumber] = useState('')

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
      // Export batch data as ZIP with designs
      const response = await fetch(`/api/batches/${id}/export`)
      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${batch?.name || 'batch'}_supplier_package.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      // Mark batch as exported (only if not already exported)
      if (batch?.status !== 'exported') {
        await exportBatch.mutateAsync(id)
      }
      toast.success('Supplier package exported successfully')
    } catch (error) {
      toast.error('Failed to export batch')
    }
  }

  const handleAddTracking = async () => {
    if (!trackingNumber.trim()) {
      toast.error('Please enter a tracking number')
      return
    }

    try {
      await updateTracking.mutateAsync({ batchId: id, trackingNumber })
      toast.success('Tracking number added')
      setShowTrackingDialog(false)
      setTrackingNumber('')
    } catch (error) {
      toast.error('Failed to add tracking number')
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
          {batch.tracking_number && (
            <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
              <Truck className="h-4 w-4" />
              <span className="text-sm font-medium">{batch.tracking_number}</span>
            </div>
          )}
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
          {(batch.status === 'confirmed' || batch.status === 'exported') && (
            <>
              <Button
                onClick={handleExport}
                disabled={exportBatch.isPending}
                className="gap-2"
              >
                <FileDown className="h-4 w-4" />
                {batch.status === 'exported' ? 'Re-Export Package' : 'Export Supplier Package'}
              </Button>
              {!batch.tracking_number && (
                <Button
                  onClick={() => setShowTrackingDialog(true)}
                  variant="outline"
                  className="gap-2"
                >
                  <Truck className="h-4 w-4" />
                  Add Tracking
                </Button>
              )}
            </>
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

                // Get the design preview - try files first, then fallback to preview URL
                const designFile = workItem.files?.find((f: any) =>
                  f.kind === 'design' || f.kind === 'preview'
                )
                const previewUrl = designFile?.storage_path ||
                                  workItem.design_preview_url ||
                                  workItem.design_download_url

                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    {/* Design Thumbnail */}
                    <div className="flex-shrink-0">
                      {previewUrl ? (
                        <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted">
                          <Image
                            src={previewUrl.startsWith('http') ? previewUrl : `/api/files/proxy?path=${encodeURIComponent(previewUrl)}`}
                            alt="Design preview"
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Work Item Info */}
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

      {/* Batch Email Status */}
      {batch.status !== 'draft' && (
        <Card>
          <CardHeader>
            <CardTitle>Customer Email Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <BatchEmailStatus batchId={id} />
          </CardContent>
        </Card>
      )}

      {/* Tracking Number Dialog */}
      <Dialog open={showTrackingDialog} onOpenChange={setShowTrackingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Tracking Number</DialogTitle>
            <DialogDescription>
              Enter the shipping tracking number for this batch
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="tracking">Tracking Number</Label>
              <Input
                id="tracking"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g., 1Z999AA10123456784"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTrackingDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddTracking}
              disabled={!trackingNumber.trim() || updateTracking.isPending}
            >
              Add Tracking Number
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
