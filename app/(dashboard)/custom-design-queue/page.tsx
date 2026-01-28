'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  useCustomDesignDesigning,
  useCustomDesignAwaitingApproval,
  useCustomDesignAwaitingPayment,
  useUpdateWorkItemStatus,
} from '@/lib/hooks/use-work-items'
import { Palette, Clock, DollarSign, ArrowRight, Upload, Mail } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

export default function CustomDesignQueuePage() {
  const { data: designing } = useCustomDesignDesigning()
  const { data: awaitingApproval } = useCustomDesignAwaitingApproval()
  const { data: awaitingPayment } = useCustomDesignAwaitingPayment()
  const updateStatus = useUpdateWorkItemStatus()

  const totalActive = (designing?.length || 0) + (awaitingApproval?.length || 0) + (awaitingPayment?.length || 0)

  const handleStatusChange = async (workItemId: string, newStatus: string, note: string) => {
    try {
      await updateStatus.mutateAsync({ id: workItemId, status: newStatus, note })
      toast.success('Status updated successfully')
    } catch (error) {
      toast.error('Failed to update status')
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Custom Design Queue</h1>
          <p className="text-muted-foreground">Projects where we design for the customer</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {totalActive} Active
          </Badge>
        </div>
      </div>

      {/* Designing Section (We have the ball) */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#9C27B0]/10">
            <Palette className="h-5 w-5 text-[#9C27B0]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Designing</h2>
            <p className="text-sm text-muted-foreground">We have the ball - need to create/revise design</p>
          </div>
          <Badge variant="outline" className="ml-auto">
            {designing?.length || 0}
          </Badge>
        </div>

        {designing && designing.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {designing.map((item) => (
              <Card key={item.id} className="border-l-4 border-l-[#9C27B0]">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base">
                        {item.customer_name || item.customer_email}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.title || 'Custom Design Project'}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Started {item.created_at && formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </div>
                  {item.event_date && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Event:</span>{' '}
                      <span className="font-medium">{item.event_date}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleStatusChange(item.id, 'proof_sent', 'Sent proof to customer')}
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      Mark Proof Sent
                    </Button>
                    <Link href={`/work-items/${item.id}`} className="flex-1">
                      <Button variant="secondary" size="sm" className="w-full">
                        <ArrowRight className="h-3 w-3 mr-1" />
                        Open
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Palette className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No projects in design phase</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Awaiting Approval Section (Customer has the ball) */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#FF9800]/10">
            <Clock className="h-5 w-5 text-[#FF9800]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Awaiting Customer Approval</h2>
            <p className="text-sm text-muted-foreground">Customer reviewing proof - waiting for feedback</p>
          </div>
          <Badge variant="outline" className="ml-auto">
            {awaitingApproval?.length || 0}
          </Badge>
        </div>

        {awaitingApproval && awaitingApproval.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {awaitingApproval.map((item) => {
              const daysSinceCreated = item.created_at
                ? Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24))
                : 0
              const needsFollowUp = daysSinceCreated > 3

              return (
                <Card key={item.id} className="border-l-4 border-l-[#FF9800]">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base">
                          {item.customer_name || item.customer_email}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.title || 'Custom Design Project'}
                        </p>
                      </div>
                      {needsFollowUp && (
                        <Badge variant="destructive" className="ml-2">
                          Follow-up
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Sent {item.created_at && formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </div>
                    {needsFollowUp && (
                      <p className="text-sm text-[#FF9800] font-medium">
                        Waiting {daysSinceCreated} days - consider sending reminder
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleStatusChange(item.id, 'in_design', 'Customer requested revisions')}
                      >
                        Revise Design
                      </Button>
                      <Link href={`/work-items/${item.id}`} className="flex-1">
                        <Button variant="secondary" size="sm" className="w-full">
                          <ArrowRight className="h-3 w-3 mr-1" />
                          Open
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No proofs awaiting customer approval</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Awaiting Payment Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#4CAF50]/10">
            <DollarSign className="h-5 w-5 text-[#4CAF50]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Awaiting Payment</h2>
            <p className="text-sm text-muted-foreground">Design approved - invoice sent for final order</p>
          </div>
          <Badge variant="outline" className="ml-auto">
            {awaitingPayment?.length || 0}
          </Badge>
        </div>

        {awaitingPayment && awaitingPayment.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {awaitingPayment.map((item) => {
              const daysSinceCreated = item.created_at
                ? Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24))
                : 0

              return (
                <Card key={item.id} className="border-l-4 border-l-[#4CAF50]">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base">
                          {item.customer_name || item.customer_email}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.title || 'Custom Design Project'}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-[#4CAF50]/10 text-[#4CAF50]">
                        Approved
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      Invoice sent {item.created_at && formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </div>
                    {item.shopify_order_number && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Order:</span>{' '}
                        <span className="font-medium">#{item.shopify_order_number}</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleStatusChange(item.id, 'paid_ready_for_batch', 'Payment received')}
                      >
                        Mark Paid
                      </Button>
                      <Link href={`/work-items/${item.id}`} className="flex-1">
                        <Button variant="secondary" size="sm" className="w-full">
                          <ArrowRight className="h-3 w-3 mr-1" />
                          Open
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No invoices awaiting payment</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
