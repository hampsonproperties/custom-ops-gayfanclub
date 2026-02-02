'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useDesignReviewQueue, useUpdateWorkItemStatus } from '@/lib/hooks/use-work-items'
import { SLAIndicator } from '@/components/custom/sla-indicator'
import { CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function DesignQueuePage() {
  const { data: queue, isLoading } = useDesignReviewQueue()
  const updateStatus = useUpdateWorkItemStatus()
  const router = useRouter()

  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [showFixDialog, setShowFixDialog] = useState(false)
  const [fixNotes, setFixNotes] = useState('')

  const calculateSLA = (createdAt: string) => {
    const created = new Date(createdAt)
    const now = new Date()
    const hoursSince = (now.getTime() - created.getTime()) / (1000 * 60 * 60)

    if (hoursSince > 24) return 'overdue'
    if (hoursSince > 6) return 'expiring'
    if (hoursSince < 1) return 'new'
    return 'on_track'
  }

  const handleApprove = async (itemId: string) => {
    await updateStatus.mutateAsync({
      id: itemId,
      status: 'approved',
      note: 'Design approved',
    })
  }

  const handleRequestFix = async () => {
    if (!selectedItem || !fixNotes.trim()) return

    await updateStatus.mutateAsync({
      id: selectedItem.id,
      status: 'needs_customer_fix',
      note: `Design fix requested: ${fixNotes}`,
    })

    // TODO: Send email to customer with fix notes
    // This will be implemented in email send section

    setShowFixDialog(false)
    setSelectedItem(null)
    setFixNotes('')
  }

  const openFixDialog = (item: any) => {
    setSelectedItem(item)
    setShowFixDialog(true)
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <p>Loading design review queue...</p>
      </div>
    )
  }

  const pendingCount = queue?.filter(item => item.status === 'needs_design_review').length || 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Design Review Queue</h1>
          <p className="text-muted-foreground">
            {pendingCount} pending proof{pendingCount !== 1 ? 's' : ''} requiring attention
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Queue Health:</span>
          {pendingCount === 0 ? (
            <Badge className="bg-[#4CAF50] text-white">All Clear</Badge>
          ) : pendingCount <= 5 ? (
            <Badge className="bg-[#FFC107] text-black">Normal</Badge>
          ) : (
            <Badge className="bg-[#E91E63] text-white">Busy</Badge>
          )}
        </div>
      </div>

      {!queue || queue.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-[#4CAF50] mb-4" />
            <p className="text-lg font-medium">All caught up!</p>
            <p className="text-sm text-muted-foreground">No designs pending review</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {queue.map((item) => {
            const slaState = calculateSLA(item.created_at)

            return (
              <Card
                key={item.id}
                className={`hover:shadow-lg transition-all cursor-pointer ${
                  slaState === 'overdue' ? 'border-l-4 border-l-[#E91E63]' :
                  slaState === 'expiring' ? 'border-l-4 border-l-[#FFC107]' :
                  slaState === 'new' ? 'border-l-4 border-l-[#9C27B0]' : ''
                }`}
                onClick={() => router.push(`/work-items/${item.id}`)}
              >
                <CardContent className="p-6">
                  <div className="flex gap-6">
                    {/* Design Preview Thumbnail */}
                    <div className="flex-shrink-0">
                      {item.design_preview_url ? (
                        <div className="relative h-32 w-32 rounded-lg border bg-muted overflow-hidden">
                          <Image
                            src={item.design_preview_url}
                            alt="Design preview"
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-32 w-32 rounded-lg border bg-muted flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">No preview</span>
                        </div>
                      )}
                    </div>

                    {/* Order Details */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {item.customer_name || 'Unknown Customer'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Order #{item.shopify_order_number}
                          </p>
                        </div>
                        <SLAIndicator
                          state={slaState}
                          label={
                            slaState === 'overdue' ? `OVERDUE ${Math.floor((new Date().getTime() - new Date(item.created_at).getTime()) / (1000 * 60 * 60))}h` :
                            slaState === 'expiring' ? `${Math.floor((new Date().getTime() - new Date(item.created_at).getTime()) / (1000 * 60 * 60))}h ago` :
                            slaState === 'new' ? 'NEW' :
                            'ON TRACK'
                          }
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Quantity:</span>
                          <span className="ml-2 font-medium">{item.quantity || '-'} units</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Grip Color:</span>
                          <span className="ml-2 font-medium">{item.grip_color || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Ordered:</span>
                          <span className="ml-2 font-medium">
                            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>

                      {item.status === 'needs_customer_fix' && (
                        <div className="bg-[#FF9800]/10 border border-[#FF9800]/30 rounded-md p-3">
                          <p className="text-sm font-medium text-[#F57C00]">Awaiting customer fix</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                      {item.design_download_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => window.open(item.design_download_url!, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                          View Full
                        </Button>
                      )}

                      <Button
                        size="sm"
                        className="gap-2 bg-[#4CAF50] hover:bg-[#388E3C] text-white"
                        onClick={() => handleApprove(item.id)}
                        disabled={updateStatus.isPending}
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve
                      </Button>

                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-2 bg-[#FF9800] hover:bg-[#F57C00] text-white"
                        onClick={() => openFixDialog(item)}
                        disabled={updateStatus.isPending}
                      >
                        <AlertCircle className="h-4 w-4" />
                        Request Fix
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Request Fix Dialog */}
      <Dialog open={showFixDialog} onOpenChange={setShowFixDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Design Fix</DialogTitle>
            <DialogDescription>
              What needs to be adjusted on this design?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Fix Notes</label>
              <Textarea
                value={fixNotes}
                onChange={(e) => setFixNotes(e.target.value)}
                placeholder="Please adjust the text size on the right panel to match the left..."
                rows={4}
              />
            </div>

            <div className="bg-muted p-3 rounded-md">
              <p className="text-xs text-muted-foreground">
                An email will be sent to the customer with these notes asking them to resubmit their design.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowFixDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleRequestFix}
                disabled={!fixNotes.trim() || updateStatus.isPending}
                className="bg-[#FF9800] hover:bg-[#F57C00]"
              >
                Send Fix Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
