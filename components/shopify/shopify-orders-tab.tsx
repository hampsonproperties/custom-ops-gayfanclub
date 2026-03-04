'use client'

/**
 * Shopify Orders Tab Component
 * Displays Shopify order history for a customer
 * Includes manual sync button and order statistics
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RefreshCw, ExternalLink, DollarSign, Package, CheckCircle2, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

const log = logger('shopify-orders-tab')

interface ShopifyOrdersTabProps {
  customerId: string
  customerEmail: string
}

export function ShopifyOrdersTab({ customerId, customerEmail }: ShopifyOrdersTabProps) {
  const queryClient = useQueryClient()
  const [isSyncing, setIsSyncing] = useState(false)

  // Fetch orders for this customer (by customer_id or email)
  const { data: orders, isLoading } = useQuery({
    queryKey: ['shopify-orders', customerId, customerEmail],
    queryFn: async () => {
      const supabase = createClient()

      // Use separate queries for better safety and type checking
      // Query by customer_id first
      let query = supabase
        .from('shopify_orders')
        .select('*')
        .eq('customer_id', customerId)

      const { data: customerIdOrders, error: error1 } = await query.order('created_at', { ascending: false })

      // Query by email if provided
      let emailOrders: any[] = []
      if (customerEmail) {
        const { data: emailData, error: error2 } = await supabase
          .from('shopify_orders')
          .select('*')
          .eq('customer_email', customerEmail.toLowerCase())
          .order('created_at', { ascending: false })

        if (error2) throw error2
        emailOrders = emailData || []
      }

      if (error1) throw error1

      // Merge and deduplicate results
      const allOrders = [...(customerIdOrders || []), ...emailOrders]
      const uniqueOrders = Array.from(
        new Map(allOrders.map(order => [order.shopify_order_id, order])).values()
      )

      // Sort by created_at descending
      return uniqueOrders.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    },
  })

  // Manual sync handler
  const handleSync = async () => {
    setIsSyncing(true)
    try {
      log.info('Starting Shopify order sync')
      const response = await fetch('/api/shopify/sync-orders', {
        method: 'POST',
      })
      log.info('Sync response received', { status: response.status, statusText: response.statusText })

      const data = await response.json()
      log.info('Sync response data', { data })

      if (data.success) {
        toast.success(`Synced ${data.synced} orders from Shopify`)
        queryClient.invalidateQueries({ queryKey: ['shopify-orders'] })
      } else {
        toast.error(data.error || 'Failed to sync orders')
      }
    } catch (error) {
      log.error('Sync error', { error })
      toast.error('Failed to sync orders')
    } finally {
      setIsSyncing(false)
    }
  }

  // Helper to get status badge variant
  const getFinancialStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      paid: 'default',
      pending: 'secondary',
      refunded: 'destructive',
      partially_refunded: 'outline',
    }
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>
  }

  // Helper to get fulfillment icon
  const getFulfillmentStatusIcon = (status: string | null) => {
    if (status === 'fulfilled') return <CheckCircle2 className="h-4 w-4 text-green-600" />
    if (status === 'partial') return <Clock className="h-4 w-4 text-yellow-600" />
    return <Package className="h-4 w-4 text-gray-400" />
  }

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading orders...</div>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Shopify Order History</CardTitle>
            <Button
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Orders'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!orders || orders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-semibold mb-2">No Orders Found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                No Shopify orders found for this customer.
              </p>
              <Button size="sm" onClick={handleSync} disabled={isSyncing}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Now
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Fulfillment</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order: any) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.shopify_order_number}
                      </TableCell>
                      <TableCell>
                        {format(new Date(order.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {order.line_items?.length || 0} items
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">
                            {parseFloat(order.total_price).toFixed(2)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {order.currency}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getFinancialStatusBadge(order.financial_status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getFulfillmentStatusIcon(order.fulfillment_status)}
                          <span className="text-sm text-muted-foreground">
                            {order.fulfillment_status || 'Unfulfilled'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <a
                          href={`https://${process.env.NEXT_PUBLIC_SHOPIFY_SHOP_DOMAIN}/admin/orders/${order.shopify_order_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Statistics */}
      {orders && orders.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {orders.length}
              </div>
              <p className="text-xs text-muted-foreground">Total Orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                ${orders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price), 0).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                ${(orders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price), 0) / orders.length).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Average Order</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
