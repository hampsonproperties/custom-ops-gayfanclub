'use client'

import { useState } from 'react'
import { useReadyForBatch, useUpdateWorkItemStatus } from '@/lib/hooks/use-work-items'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, Download, Eye, Package, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default function ApprovedDesignsPage() {
  const { data: approvedItems = [], isLoading } = useReadyForBatch()
  const updateStatus = useUpdateWorkItemStatus()

  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [note, setNote] = useState('')

  const handleMoveToReadyForBatch = async () => {
    if (!selectedItem) return

    await updateStatus.mutateAsync({
      id: selectedItem.id,
      status: 'ready_for_batch',
      note: note || 'Moved to Ready for Batch',
    })

    setShowMoveDialog(false)
    setSelectedItem(null)
    setNote('')
  }

  const groupByStatus = () => {
    const groups = {
      approved: approvedItems.filter(item => item.status === 'approved'),
      ready_for_batch: approvedItems.filter(item => item.status === 'ready_for_batch'),
    }
    return groups
  }

  const grouped = groupByStatus()

  if (isLoading) {
    return <div className="p-6">Loading approved designs...</div>
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Approved Designs</h1>
          <p className="text-muted-foreground mt-1">
            Designs approved and ready for production batching
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          <CheckCircle2 className="h-4 w-4 mr-2" />
          {approvedItems.length} Total
        </Badge>
      </div>

      {approvedItems.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No approved designs yet</h3>
              <p className="text-muted-foreground">
                Approved designs from the design queue will appear here
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Approved Section */}
          {grouped.approved.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-2xl font-semibold">Approved</h2>
                <Badge variant="outline" className="bg-[#4CAF50] text-white">
                  {grouped.approved.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {grouped.approved.map((item) => (
                  <Card key={item.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-1">
                            {item.customer_name || 'Unknown Customer'}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {item.shopify_order_id ? `Order #${item.shopify_order_id.slice(-8)}` : 'Assisted Project'}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-[#4CAF50] text-white">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Approved
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {item.design_preview_url && (
                        <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                          <Image
                            src={item.design_preview_url}
                            alt="Design preview"
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="space-y-1 text-sm">
                        {item.quantity && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Quantity:</span>
                            <span className="font-medium">{item.quantity}</span>
                          </div>
                        )}
                        {item.grip_color && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Grip Color:</span>
                            <span className="font-medium">{item.grip_color}</span>
                          </div>
                        )}
                        {item.event_date && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Event Date:</span>
                            <span className="font-medium">
                              {new Date(item.event_date).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 pt-2">
                        {item.design_download_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => window.open(item.design_download_url!, '_blank')}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        )}
                        <Link href={`/work-items/${item.id}`} className="flex-1">
                          <Button size="sm" variant="outline" className="w-full">
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </Link>
                      </div>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setSelectedItem(item)
                          setShowMoveDialog(true)
                        }}
                      >
                        <Package className="h-4 w-4 mr-2" />
                        Move to Ready for Batch
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Ready for Batch Section */}
          {grouped.ready_for_batch.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-2xl font-semibold">Ready for Batch</h2>
                <Badge variant="outline" className="bg-[#00BCD4] text-white">
                  {grouped.ready_for_batch.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {grouped.ready_for_batch.map((item) => (
                  <Card key={item.id} className="hover:shadow-lg transition-shadow border-[#00BCD4]">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-1">
                            {item.customer_name || 'Unknown Customer'}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {item.shopify_order_id ? `Order #${item.shopify_order_id.slice(-8)}` : 'Assisted Project'}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-[#00BCD4] text-white">
                          <Package className="h-3 w-3 mr-1" />
                          Ready
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {item.design_preview_url && (
                        <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                          <Image
                            src={item.design_preview_url}
                            alt="Design preview"
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="space-y-1 text-sm">
                        {item.quantity && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Quantity:</span>
                            <span className="font-medium">{item.quantity}</span>
                          </div>
                        )}
                        {item.grip_color && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Grip Color:</span>
                            <span className="font-medium">{item.grip_color}</span>
                          </div>
                        )}
                        {item.event_date && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Event Date:</span>
                            <span className="font-medium">
                              {new Date(item.event_date).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 pt-2">
                        {item.design_download_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => window.open(item.design_download_url!, '_blank')}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        )}
                        <Link href={`/work-items/${item.id}`} className="flex-1">
                          <Button size="sm" variant="outline" className="w-full">
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Move to Ready for Batch Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to Ready for Batch</DialogTitle>
            <DialogDescription>
              Move this design to the Ready for Batch status for production
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="note">Note (Optional)</Label>
              <Textarea
                id="note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add any notes about this design..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleMoveToReadyForBatch}>
              Move to Ready for Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
