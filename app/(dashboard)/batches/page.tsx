'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Package, Plus, FileDown, CheckCircle, Clock, ExternalLink, Truck } from 'lucide-react'
import { useReadyForBatch } from '@/lib/hooks/use-work-items'
import { useBatches, useCreateBatch, useConfirmBatch, useExportBatch } from '@/lib/hooks/use-batches'
import { StatusBadge } from '@/components/custom/status-badge'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

export default function BatchesPage() {
  const { data: readyItems, isLoading: loadingItems } = useReadyForBatch()
  const { data: batches, isLoading: loadingBatches } = useBatches()
  const createBatch = useCreateBatch()
  const confirmBatch = useConfirmBatch()
  const exportBatch = useExportBatch()

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [batchName, setBatchName] = useState('')
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  const handleToggleItem = (workItemId: string) => {
    setSelectedItems((prev) =>
      prev.includes(workItemId)
        ? prev.filter((id) => id !== workItemId)
        : [...prev, workItemId]
    )
  }

  const handleSelectAll = () => {
    if (selectedItems.length === readyItems?.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(readyItems?.map((item) => item.id) || [])
    }
  }

  const handleCreateBatch = async () => {
    if (!batchName.trim()) {
      toast.error('Please enter a batch name')
      return
    }

    if (selectedItems.length === 0) {
      toast.error('Please select at least one work item')
      return
    }

    try {
      await createBatch.mutateAsync({
        name: batchName,
        workItemIds: selectedItems,
      })

      toast.success(`Batch "${batchName}" created with ${selectedItems.length} items`)

      setShowCreateDialog(false)
      setBatchName('')
      setSelectedItems([])
    } catch (error) {
      toast.error('Failed to create batch')
    }
  }

  const handleConfirmBatch = async (batchId: string) => {
    try {
      await confirmBatch.mutateAsync(batchId)
      toast.success('Batch confirmed')
    } catch (error) {
      toast.error('Failed to confirm batch')
    }
  }

  const handleExportBatch = async (batchId: string) => {
    try {
      await exportBatch.mutateAsync(batchId)
      toast.success('Batch exported')
    } catch (error) {
      toast.error('Failed to export batch')
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Batch Builder</h1>
          <p className="text-muted-foreground">Group orders for production and create batch exports</p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          disabled={!readyItems || readyItems.length === 0}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Batch
        </Button>
      </div>

      {/* Ready for Batch Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Ready for Batch ({readyItems?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingItems ? (
            <p className="text-sm text-muted-foreground">Loading items...</p>
          ) : !readyItems || readyItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No items ready for batching. Items must be approved and paid.
            </p>
          ) : (
            <div className="space-y-2">
              {readyItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50">
                  <Checkbox
                    checked={selectedItems.includes(item.id)}
                    onCheckedChange={() => handleToggleItem(item.id)}
                  />
                  <div className="flex-1">
                    <Link
                      href={`/work-items/${item.id}`}
                      className="font-medium hover:underline"
                    >
                      {item.customer_name || item.customer_email}
                    </Link>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{item.quantity || 0} units</span>
                      <span>•</span>
                      <span>{item.shopify_order_number || 'No order'}</span>
                      <span>•</span>
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing Batches */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Batches ({batches?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingBatches ? (
            <p className="text-sm text-muted-foreground">Loading batches...</p>
          ) : !batches || batches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No batches created yet. Create your first batch above.
            </p>
          ) : (
            <div className="space-y-3">
              {batches.map((batch) => (
                <div key={batch.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <Link
                        href={`/batches/${batch.id}`}
                        className="font-medium hover:underline"
                      >
                        {batch.name}
                      </Link>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Created {formatDistanceToNow(new Date(batch.created_at), { addSuffix: true })}</span>
                        {batch.confirmed_at && (
                          <>
                            <span>•</span>
                            <span>Confirmed {formatDistanceToNow(new Date(batch.confirmed_at), { addSuffix: true })}</span>
                          </>
                        )}
                        {batch.exported_at && (
                          <>
                            <span>•</span>
                            <span>Exported {formatDistanceToNow(new Date(batch.exported_at), { addSuffix: true })}</span>
                          </>
                        )}
                      </div>
                      {batch.tracking_number && (
                        <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/20 rounded-md w-fit">
                          <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            {batch.tracking_number}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        status={batch.status}
                      />
                      {batch.status === 'draft' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConfirmBatch(batch.id)}
                          disabled={confirmBatch.isPending}
                          className="gap-2"
                        >
                          <CheckCircle className="h-3 w-3" />
                          Confirm
                        </Button>
                      )}
                      {batch.status === 'confirmed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportBatch(batch.id)}
                          disabled={exportBatch.isPending}
                          className="gap-2"
                        >
                          <FileDown className="h-3 w-3" />
                          Export
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Batch Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Batch</DialogTitle>
            <DialogDescription>
              Select work items to include in this production batch
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="batch-name">Batch Name</Label>
              <Input
                id="batch-name"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="e.g., Batch 2026-01-28"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Selected Items ({selectedItems.length})</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedItems.length === readyItems?.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="border rounded-lg p-3 max-h-64 overflow-y-auto space-y-2">
                {readyItems?.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedItems.includes(item.id)}
                      onCheckedChange={() => handleToggleItem(item.id)}
                    />
                    <div className="flex-1 text-sm">
                      <p className="font-medium">{item.customer_name || item.customer_email}</p>
                      <p className="text-muted-foreground">
                        {item.quantity || 0} units • {item.shopify_order_number}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateBatch}
              disabled={createBatch.isPending || !batchName.trim() || selectedItems.length === 0}
            >
              Create Batch ({selectedItems.length} items)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
