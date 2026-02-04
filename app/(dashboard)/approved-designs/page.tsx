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
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
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
                          <Button size="sm" variant="outline" className="w-full h-8">
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          className="flex-1 h-8"
                          onClick={() => {
                            setSelectedItem(item)
                            setShowMoveDialog(true)
                          }}
                        >
                          <Package className="h-3 w-3 mr-1" />
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
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
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
                        <Button size="sm" variant="outline" className="w-full h-8">
                          <Eye className="h-3 w-3 mr-1" />
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
