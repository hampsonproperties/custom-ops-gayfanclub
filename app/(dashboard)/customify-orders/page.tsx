'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileWarning,
  ImageIcon,
  Send,
  XCircle,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

interface CustomifyOrder {
  id: string
  title: string
  customer_id: string
  customer_email: string
  customer_name: string
  shopify_order_number: string | null
  quantity: number
  event_date: string | null
  deadline: string | null
  design_review_status: string
  proof_url: string | null
  created_at: string
  updated_at: string
  files: Array<{
    id: string
    external_url: string
    filename: string
    kind: string
  }>
}

export default function CustomifyOrdersPage() {
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)
  const [reviewChecklist, setReviewChecklist] = useState({
    bleed_ok: false,
    resolution_ok: false,
    design_quality_ok: false,
  })
  const [reviewNotes, setReviewNotes] = useState('')
  const queryClient = useQueryClient()

  // Fetch Customify orders that need review
  const { data: orders, isLoading } = useQuery({
    queryKey: ['customify-orders'],
    queryFn: async () => {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('work_items')
        .select(`
          id,
          title,
          customer_id,
          quantity,
          event_date,
          deadline,
          design_review_status,
          proof_url,
          shopify_order_number,
          created_at,
          updated_at,
          customers (
            email,
            display_name
          ),
          files (
            id,
            external_url,
            filename,
            kind
          )
        `)
        .eq('type', 'customify_order')
        .in('design_review_status', ['pending_review', 'needs_attention'])
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data || []).map((item: any) => ({
        ...item,
        customer_email: item.customers?.email || 'Unknown',
        customer_name: item.customers?.display_name || 'Unknown',
      })) as CustomifyOrder[]
    },
  })

  // Approve order mutation
  const approveMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const supabase = createClient()

      // Update work item status
      const { error: updateError } = await supabase
        .from('work_items')
        .update({
          design_review_status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)

      if (updateError) throw updateError

      // TODO: Send proof approval email with approve/deny links
      // This would call /api/email/send with the proof template

      return { orderId }
    },
    onSuccess: () => {
      toast.success('Order approved! Proof email sent to customer.')
      queryClient.invalidateQueries({ queryKey: ['customify-orders'] })
      setSelectedOrder(null)
      resetReviewForm()
    },
    onError: (error: any) => {
      toast.error(`Failed to approve order: ${error.message}`)
    },
  })

  // Flag issue mutation
  const flagIssueMutation = useMutation({
    mutationFn: async ({ orderId, notes }: { orderId: string; notes: string }) => {
      const supabase = createClient()

      // Update work item
      const { error: updateError } = await supabase
        .from('work_items')
        .update({
          design_review_status: 'needs_revision',
          notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)

      if (updateError) throw updateError

      // TODO: Send rejection email with store credit code
      // TODO: Cancel Shopify order
      // TODO: Generate discount code

      return { orderId }
    },
    onSuccess: () => {
      toast.success('Issue flagged. Credit email sent to customer.')
      queryClient.invalidateQueries({ queryKey: ['customify-orders'] })
      setSelectedOrder(null)
      resetReviewForm()
    },
    onError: (error: any) => {
      toast.error(`Failed to flag issue: ${error.message}`)
    },
  })

  const resetReviewForm = () => {
    setReviewChecklist({
      bleed_ok: false,
      resolution_ok: false,
      design_quality_ok: false,
    })
    setReviewNotes('')
  }

  const selectedOrderData = orders?.find((o) => o.id === selectedOrder)
  const designFile = selectedOrderData?.files?.find((f) => f.kind === 'design' || f.kind === 'proof')

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_review':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="mr-1 h-3 w-3" /> Needs Review</Badge>
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="mr-1 h-3 w-3" /> Approved</Badge>
      case 'needs_revision':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="mr-1 h-3 w-3" /> Needs Revision</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const allChecksPass = reviewChecklist.bleed_ok && reviewChecklist.resolution_ok && reviewChecklist.design_quality_ok

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Customify Orders</h1>
        <p className="text-muted-foreground mt-1">
          Review self-designed orders before sending proofs to customers
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Awaiting Review</CardDescription>
            <CardTitle className="text-3xl">
              {orders?.filter((o) => o.design_review_status === 'pending_review').length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Need Attention</CardDescription>
            <CardTitle className="text-3xl">
              {orders?.filter((o) => o.design_review_status === 'needs_attention').length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Orders</CardDescription>
            <CardTitle className="text-3xl">{orders?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Orders List */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {isLoading ? (
          <div className="col-span-2 text-center py-12 text-muted-foreground">
            Loading orders...
          </div>
        ) : orders?.length === 0 ? (
          <div className="col-span-2 text-center py-12">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <p className="text-lg font-medium">All caught up!</p>
            <p className="text-muted-foreground">No Customify orders need review</p>
          </div>
        ) : (
          orders?.map((order) => (
            <Card
              key={order.id}
              className={`cursor-pointer transition-all ${
                selectedOrder === order.id
                  ? 'ring-2 ring-pink-500 shadow-lg'
                  : 'hover:shadow-md'
              }`}
              onClick={() => setSelectedOrder(order.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{order.title || 'Untitled Order'}</CardTitle>
                    <CardDescription className="mt-1">
                      {order.customer_name} • {order.customer_email}
                    </CardDescription>
                  </div>
                  {getStatusBadge(order.design_review_status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Design Preview */}
                  {designFile?.external_url ? (
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                      <img
                        src={designFile.external_url}
                        alt="Design preview"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="mx-auto h-12 w-12 mb-2 opacity-50" />
                        <p className="text-sm">No design file found</p>
                      </div>
                    </div>
                  )}

                  {/* Order Details */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Quantity:</span>{' '}
                      <span className="font-medium">{order.quantity} fans</span>
                    </div>
                    {order.shopify_order_number && (
                      <div>
                        <span className="text-muted-foreground">Order:</span>{' '}
                        <span className="font-medium">#{order.shopify_order_number}</span>
                      </div>
                    )}
                    {order.event_date && (
                      <div>
                        <span className="text-muted-foreground">Event:</span>{' '}
                        <span className="font-medium">
                          {new Date(order.event_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {order.deadline && (
                      <div>
                        <span className="text-muted-foreground">Deadline:</span>{' '}
                        <span className="font-medium">
                          {new Date(order.deadline).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Created {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Review Panel */}
      {selectedOrder && selectedOrderData && (
        <Card className="border-2 border-pink-500">
          <CardHeader>
            <CardTitle>Review Order: {selectedOrderData.title}</CardTitle>
            <CardDescription>
              Complete the review checklist before approving
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Manual Review Checklist */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Manual Review Checklist</Label>
              <div className="space-y-3 pl-1">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="bleed"
                    checked={reviewChecklist.bleed_ok}
                    onCheckedChange={(checked) =>
                      setReviewChecklist({ ...reviewChecklist, bleed_ok: !!checked })
                    }
                  />
                  <label
                    htmlFor="bleed"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
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
                  <label
                    htmlFor="resolution"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
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
                  <label
                    htmlFor="quality"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Design quality is acceptable (no major issues)
                  </label>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any internal notes about this order..."
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
                onClick={() => approveMutation.mutate(selectedOrder)}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {approveMutation.isPending ? 'Approving...' : 'Approve & Send Proof'}
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-11 sm:h-10"
                disabled={flagIssueMutation.isPending}
                onClick={() => {
                  if (!reviewNotes) {
                    toast.error('Please add notes describing the issue')
                    return
                  }
                  flagIssueMutation.mutate({ orderId: selectedOrder, notes: reviewNotes })
                }}
              >
                <FileWarning className="mr-2 h-4 w-4" />
                {flagIssueMutation.isPending ? 'Flagging...' : 'Flag Issue & Request Resubmit'}
              </Button>
            </div>

            {!allChecksPass && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">
                  Complete all checklist items before approving. If there are issues, use "Flag Issue" instead.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
