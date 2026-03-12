'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Package, Plus, FileDown, CheckCircle, Clock, Truck, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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
  const [enableDripEmails, setEnableDripEmails] = useState(false)

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

      // If enable drip emails is checked, opt these work items in (set suppress to false)
      if (enableDripEmails) {
        const supabase = createClient()
        const { error: enableError } = await supabase
          .from('work_items')
          .update({ suppress_drip_emails: false })
          .in('id', selectedItems)

        if (enableError) {
          toast.error('Batch created but failed to enable drip emails — update items manually')
        }
      }

      toast.success(`Batch "${batchName}" created with ${selectedItems.length} items${enableDripEmails ? ' (drip emails enabled)' : ''}`)

      setShowCreateDialog(false)
      setBatchName('')
      setSelectedItems([])
      setEnableDripEmails(false)
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

  const handleExportBatch = async (batchId: string, batchName: string) => {
    try {
      const response = await fetch(`/api/batches/${batchId}/export`)
      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${batchName || 'batch'}_supplier_package.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      await exportBatch.mutateAsync(batchId)
      toast.success('Batch exported')
    } catch (error) {
      toast.error('Failed to export batch')
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Batch Builder</h1>
          <p className="text-muted-foreground">Group orders for production and create batch exports</p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          disabled={!readyItems || readyItems.length === 0}
          className="gap-2 w-full sm:w-auto"
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
                <div key={item.id} className="flex items-start gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="pt-1">
                    <Checkbox
                      checked={selectedItems.includes(item.id)}
                      onCheckedChange={() => handleToggleItem(item.id)}
                      className="h-5 w-5"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/work-items/${item.id}`}
                      className="font-medium hover:underline block mb-1"
                    >
                      {(item as any).customer?.display_name || item.customer_name || (item as any).customer?.email || item.customer_email}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>{item.quantity || 0} units</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="truncate">{item.shopify_order_number || 'No order'}</span>
                      <StatusBadge status={item.status} className="mt-1 sm:mt-0" />
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
                <div key={batch.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="space-y-2 flex-1 min-w-0">
                      <span className="font-medium text-lg block">
                        {batch.name}
                      </span>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm text-muted-foreground">
                        <span>Created {formatDistanceToNow(new Date(batch.created_at || ''), { addSuffix: true })}</span>
                        {batch.confirmed_at && (
                          <>
                            <span className="hidden sm:inline">•</span>
                            <span>Confirmed {formatDistanceToNow(new Date(batch.confirmed_at), { addSuffix: true })}</span>
                          </>
                        )}
                        {batch.exported_at && (
                          <>
                            <span className="hidden sm:inline">•</span>
                            <span>Exported {formatDistanceToNow(new Date(batch.exported_at), { addSuffix: true })}</span>
                          </>
                        )}
                      </div>
                      {batch.tracking_number && (
                        <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/20 rounded-md w-fit">
                          <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            {batch.tracking_number}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <StatusBadge status={batch.status ?? ''} />
                      {batch.status === 'draft' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConfirmBatch(batch.id)}
                          disabled={confirmBatch.isPending}
                          className="gap-2 h-11 sm:h-9"
                        >
                          <CheckCircle className="h-4 w-4" />
                          <span>Confirm</span>
                        </Button>
                      )}
                      {batch.status === 'confirmed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportBatch(batch.id, batch.name)}
                          disabled={exportBatch.isPending}
                          className="gap-2 h-11 sm:h-9"
                        >
                          <FileDown className="h-4 w-4" />
                          <span>Export</span>
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
        <DialogContent className="max-w-md">
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
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Selected Items ({selectedItems.length})</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-9"
                >
                  {selectedItems.length === readyItems?.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="border rounded-lg p-3 max-h-64 overflow-y-auto space-y-2">
                {readyItems?.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 py-2">
                    <div className="pt-0.5">
                      <Checkbox
                        checked={selectedItems.includes(item.id)}
                        onCheckedChange={() => handleToggleItem(item.id)}
                        className="h-5 w-5"
                      />
                    </div>
                    <div className="flex-1 text-sm min-w-0">
                      <p className="font-medium truncate">{(item as any).customer?.display_name || item.customer_name || (item as any).customer?.email || item.customer_email}</p>
                      <p className="text-muted-foreground">
                        {item.quantity || 0} units • {item.shopify_order_number}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Enable Drip Emails */}
            <div className="flex items-start gap-3 p-3 border rounded-lg bg-muted/50">
              <Checkbox
                id="enable-drip"
                checked={enableDripEmails}
                onCheckedChange={(checked) => setEnableDripEmails(checked === true)}
                className="mt-0.5"
              />
              <div>
                <label htmlFor="enable-drip" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Send drip emails for this batch
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Enable automated production update emails to customers in this batch
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="w-full sm:w-auto h-11 sm:h-9">
              Cancel
            </Button>
            <Button
              onClick={handleCreateBatch}
              disabled={createBatch.isPending || !batchName.trim() || selectedItems.length === 0}
              className="w-full sm:w-auto h-11 sm:h-9"
            >
              Create Batch ({selectedItems.length} items)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
