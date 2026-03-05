'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { FileGallery } from '@/components/files/file-gallery'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useDesignReviewQueue, useUpdateWorkItemStatus } from '@/lib/hooks/use-work-items'
import { SLAIndicator } from '@/components/custom/sla-indicator'
import {
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  FileWarning,
  ImageIcon,
  XCircle,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

export default function CustomifyOrdersPage() {
  const { data: orders, isLoading } = useDesignReviewQueue()
  const updateStatus = useUpdateWorkItemStatus()
  const queryClient = useQueryClient()

  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)
  const [reviewChecklist, setReviewChecklist] = useState({
    bleed_ok: false,
    resolution_ok: false,
    design_quality_ok: false,
  })
  const [reviewNotes, setReviewNotes] = useState('')
  const [showFixDialog, setShowFixDialog] = useState(false)

  const resetReviewForm = () => {
    setReviewChecklist({ bleed_ok: false, resolution_ok: false, design_quality_ok: false })
    setReviewNotes('')
  }

  const calculateSLA = (createdAt: string) => {
    const hours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60)
    if (hours > 24) return 'overdue'
    if (hours > 6) return 'expiring'
    if (hours < 1) return 'new'
    return 'on_track'
  }

  // Approve: update status + send proof email
  const approveMutation = useMutation({
    mutationFn: async ({ orderId, fileId }: { orderId: string; fileId: string }) => {
      // Send proof email first — only update status if email succeeds
      const res = await fetch('/api/send-approval-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workItemId: orderId, fileId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to send approval email' }))
        throw new Error(err.error || 'Failed to send approval email')
      }

      await updateStatus.mutateAsync({
        id: orderId,
        status: 'approved',
        note: 'Design approved — proof sent to customer',
      })
    },
    onSuccess: () => {
      toast.success('Order approved! Proof email sent to customer.')
      queryClient.invalidateQueries({ queryKey: ['work-items', 'design-review-queue'] })
      setSelectedOrder(null)
      resetReviewForm()
    },
    onError: (error: any) => {
      toast.error(`Failed to approve: ${error.message}`)
    },
  })

  // Request fix: update status + send email to customer
  const handleRequestFix = async () => {
    if (!selectedOrder || !reviewNotes.trim()) return
    const order = orders?.find((o: any) => o.id === selectedOrder)
    if (!order) return

    try {
      await updateStatus.mutateAsync({
        id: selectedOrder,
        status: 'needs_customer_fix',
        note: `Design fix requested: ${reviewNotes}`,
      })

      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: order.customer_email,
          subject: `Design Fix Needed — Order #${order.shopify_order_number || order.id.slice(0, 8)}`,
          body: reviewNotes,
          projectId: order.id,
        }),
      })
      if (!res.ok) throw new Error('Failed to send email')
      toast.success('Fix request sent to customer')
    } catch {
      toast.error('Status updated but email may not have sent')
    }

    queryClient.invalidateQueries({ queryKey: ['work-items', 'design-review-queue'] })
    setShowFixDialog(false)
    setSelectedOrder(null)
    resetReviewForm()
  }

  const selectedOrderData = orders?.find((o: any) => o.id === selectedOrder)
  const pendingCount = orders?.filter((o: any) => o.status === 'needs_design_review').length || 0
  const fixCount = orders?.filter((o: any) => o.status === 'needs_customer_fix').length || 0
  const allChecksPass = reviewChecklist.bleed_ok && reviewChecklist.resolution_ok && reviewChecklist.design_quality_ok

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customify Review</h1>
          <p className="text-muted-foreground mt-1">
            Review self-designed orders before sending proofs to customers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Queue:</span>
          {pendingCount === 0 && fixCount === 0 ? (
            <Badge className="bg-[#4CAF50] text-white">All Clear</Badge>
          ) : pendingCount <= 5 ? (
            <Badge className="bg-[#FFC107] text-black">Normal</Badge>
          ) : (
            <Badge className="bg-[#E91E63] text-white">Busy</Badge>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Awaiting Review</CardDescription>
            <CardTitle className="text-3xl">{pendingCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Awaiting Customer Fix</CardDescription>
            <CardTitle className="text-3xl">{fixCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total in Queue</CardDescription>
            <CardTitle className="text-3xl">{orders?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading orders...</div>
      ) : !orders || orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <p className="text-lg font-medium">All caught up!</p>
            <p className="text-muted-foreground">No Customify orders need review</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order: any) => {
            const sla = calculateSLA(order.created_at)
            const isSelected = selectedOrder === order.id

            return (
              <Card
                key={order.id}
                className={`cursor-pointer transition-all ${
                  isSelected ? 'ring-2 ring-pink-500 shadow-lg' : 'hover:shadow-md'
                } ${
                  sla === 'overdue' ? 'border-l-4 border-l-[#E91E63]' :
                  sla === 'expiring' ? 'border-l-4 border-l-[#FFC107]' :
                  sla === 'new' ? 'border-l-4 border-l-[#9C27B0]' : ''
                }`}
                onClick={() => {
                  setSelectedOrder(isSelected ? null : order.id)
                  if (!isSelected) resetReviewForm()
                }}
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                    {/* Design Preview / File Gallery */}
                    <div className="flex-shrink-0 w-full sm:w-32">
                      {order.files && order.files.length > 0 ? (
                        <FileGallery files={order.files} />
                      ) : (
                        <div className="h-32 w-full sm:w-32 rounded-lg border bg-muted flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground opacity-50" />
                        </div>
                      )}
                    </div>

                    {/* Order Details */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {order.customer_name || order.title || 'Unknown Customer'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {order.shopify_order_number ? `Order #${order.shopify_order_number}` : order.customer_email}
                          </p>
                        </div>
                        <SLAIndicator
                          state={sla}
                          label={
                            sla === 'overdue' ? `OVERDUE ${Math.floor((Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60))}h` :
                            sla === 'new' ? 'NEW' :
                            sla === 'expiring' ? `${Math.floor((Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60))}h ago` :
                            'ON TRACK'
                          }
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Quantity:</span>{' '}
                          <span className="font-medium">{order.quantity || '-'} fans</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Status:</span>{' '}
                          {order.status === 'needs_customer_fix' ? (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                              <XCircle className="mr-1 h-3 w-3" /> Awaiting Fix
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                              <Clock className="mr-1 h-3 w-3" /> Needs Review
                            </Badge>
                          )}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Submitted:</span>{' '}
                          <span className="font-medium">
                            {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex-shrink-0 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                      {order.design_download_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => window.open(order.design_download_url!, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                          View Full
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Review Panel */}
      {selectedOrder && selectedOrderData && (
        <Card className="border-2 border-pink-500">
          <CardHeader>
            <CardTitle>Review: {selectedOrderData.title || selectedOrderData.customer_name}</CardTitle>
            <CardDescription>Complete the checklist, then approve or request a fix</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Review Checklist */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Review Checklist</Label>
              <div className="space-y-3 pl-1">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="bleed"
                    checked={reviewChecklist.bleed_ok}
                    onCheckedChange={(checked) =>
                      setReviewChecklist({ ...reviewChecklist, bleed_ok: !!checked })
                    }
                  />
                  <label htmlFor="bleed" className="text-sm font-medium leading-none">
                    No bleed issues (design extends to edges properly)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="resolution"
                    checked={reviewChecklist.resolution_ok}
                    onCheckedChange={(checked) =>
                      setReviewChecklist({ ...reviewChecklist, resolution_ok: !!checked })
                    }
                  />
                  <label htmlFor="resolution" className="text-sm font-medium leading-none">
                    Resolution is acceptable (at least 300 DPI)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="quality"
                    checked={reviewChecklist.design_quality_ok}
                    onCheckedChange={(checked) =>
                      setReviewChecklist({ ...reviewChecklist, design_quality_ok: !!checked })
                    }
                  />
                  <label htmlFor="quality" className="text-sm font-medium leading-none">
                    Design quality is acceptable (no major issues)
                  </label>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add notes (required for fix requests)..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 h-11 sm:h-10"
                disabled={!allChecksPass || approveMutation.isPending}
                onClick={() => {
                  if (!selectedOrderData?.files?.length) {
                    toast.error('Cannot approve: no design files attached')
                    return
                  }
                  approveMutation.mutate({ orderId: selectedOrder, fileId: selectedOrderData.files[0].id })
                }}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {approveMutation.isPending ? 'Approving...' : 'Approve & Send Proof'}
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-11 sm:h-10"
                disabled={updateStatus.isPending}
                onClick={() => {
                  if (!reviewNotes.trim()) {
                    toast.error('Please add notes describing the issue')
                    return
                  }
                  setShowFixDialog(true)
                }}
              >
                <FileWarning className="mr-2 h-4 w-4" />
                Request Fix
              </Button>
            </div>

            {!allChecksPass && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">
                  Complete all checklist items before approving. If there are issues, use &quot;Request Fix&quot; instead.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirm Fix Request Dialog */}
      <Dialog open={showFixDialog} onOpenChange={setShowFixDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Fix Request?</DialogTitle>
            <DialogDescription>
              This will email the customer asking them to resubmit their design.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm">{reviewNotes}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowFixDialog(false)}>Cancel</Button>
              <Button
                onClick={handleRequestFix}
                disabled={updateStatus.isPending}
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
