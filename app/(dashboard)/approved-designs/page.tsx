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
      ready_for_batch: approvedItems.filter(item =>
        item.status === 'ready_for_batch' ||
        item.status === 'paid_ready_for_batch' ||
        item.status === 'deposit_paid_ready_for_batch' ||
        item.status === 'on_payment_terms_ready_for_batch'
      ),
    }
    return groups
  }

  const grouped = groupByStatus()

  if (isLoading) {
    return <div className="p-6">Loading approved designs...</div>
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Approved Designs</h1>
          <p className="text-muted-foreground mt-1">
            Designs approved and ready for production batching
          </p>
        </div>
        <Badge variant="secondary" className="text-base sm:text-lg px-3 py-1.5 sm:px-4 sm:py-2">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {grouped.approved.map((item) => (
                  <Card key={item.id} className="hover:shadow-lg transition-shadow overflow-hidden">
                    {item.design_preview_url && (
                      <div className="relative h-48 bg-muted">
                        <Image
                          src={item.design_preview_url}
                          alt="Design preview"
                          fill
                          className="object-cover"
                        />
                        <Badge className="absolute top-2 right-2 bg-[#4CAF50] text-white">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Approved
                        </Badge>
                      </div>
                    )}
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h3 className="font-semibold text-base truncate">
                          {item.customer_name || 'Unknown Customer'}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {item.shopify_order_number ? `Order #${item.shopify_order_number}` : 'Assisted Project'}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {item.quantity && (
                          <div>
                            <span className="text-muted-foreground">Qty:</span>
                            <span className="ml-1 font-medium">{item.quantity}</span>
                          </div>
                        )}
                        {item.grip_color && (
                          <div>
                            <span className="text-muted-foreground">Color:</span>
                            <span className="ml-1 font-medium">{item.grip_color}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/work-items/${item.id}`} className="flex-1">
                          <Button size="sm" variant="outline" className="w-full h-11 md:h-9">
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          className="flex-1 h-11 md:h-9"
                          onClick={() => {
                            setSelectedItem(item)
                            setShowMoveDialog(true)
                          }}
                        >
                          <Package className="h-4 w-4 mr-1" />
                          Batch
                        </Button>
                      </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {grouped.ready_for_batch.map((item) => (
                  <Card key={item.id} className="hover:shadow-lg transition-shadow border-[#00BCD4] overflow-hidden">
                    {item.design_preview_url && (
                      <div className="relative h-48 bg-muted">
                        <Image
                          src={item.design_preview_url}
                          alt="Design preview"
                          fill
                          className="object-cover"
                        />
                        <Badge className="absolute top-2 right-2 bg-[#00BCD4] text-white">
                          <Package className="h-3 w-3 mr-1" />
                          Ready
                        </Badge>
                      </div>
                    )}
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h3 className="font-semibold text-base truncate">
                          {item.customer_name || 'Unknown Customer'}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {item.shopify_order_number ? `Order #${item.shopify_order_number}` : 'Assisted Project'}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {item.quantity && (
                          <div>
                            <span className="text-muted-foreground">Qty:</span>
                            <span className="ml-1 font-medium">{item.quantity}</span>
                          </div>
                        )}
                        {item.grip_color && (
                          <div>
                            <span className="text-muted-foreground">Color:</span>
                            <span className="ml-1 font-medium">{item.grip_color}</span>
                          </div>
                        )}
                      </div>
                      <Link href={`/work-items/${item.id}`} className="block">
                        <Button size="sm" variant="outline" className="w-full h-11 md:h-9">
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      </Link>
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
        <DialogContent className="max-w-md">
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
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowMoveDialog(false)} className="w-full sm:w-auto h-11 sm:h-9">
              Cancel
            </Button>
            <Button onClick={handleMoveToReadyForBatch} className="w-full sm:w-auto h-11 sm:h-9">
              Move to Ready for Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
