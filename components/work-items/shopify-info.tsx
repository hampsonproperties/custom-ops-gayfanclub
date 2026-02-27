'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, ShoppingBag, DollarSign, Tag, Package, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { Database } from '@/types/database'
import { formatDistanceToNow } from 'date-fns'

type WorkItem = Database['public']['Tables']['work_items']['Row']

interface ShopifyOrder {
  id: string
  name: string
  total_price: string
  financial_status: string
  fulfillment_status: string | null
  created_at: string
  line_items: any[]
  customer: {
    email: string
    first_name: string
    last_name: string
  }
}

export function ShopifyInfo({ workItem }: { workItem: WorkItem }) {
  const [orders, setOrders] = useState<ShopifyOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true)

      // Collect all order IDs we have
      const orderIds = [
        workItem.shopify_order_id,
        workItem.design_fee_order_id,
        workItem.shopify_draft_order_id,
      ].filter(Boolean)

      if (orderIds.length === 0 && !workItem.customer_email) {
        setOrders([])
        setLoading(false)
        return
      }

      try {
        const params = new URLSearchParams()
        if (orderIds.length > 0) {
          params.set('orderIds', orderIds.join(','))
        }
        // Use customer ID if available (most reliable), fallback to email
        if (workItem.shopify_customer_id) {
          params.set('customerId', workItem.shopify_customer_id)
        } else if (workItem.customer_email) {
          params.set('email', workItem.customer_email)
        }

        const response = await fetch(`/api/shopify/get-orders?${params.toString()}`)
        const data = await response.json()

        if (data.success && data.orders) {
          setOrders(data.orders)
        } else {
          setOrders([])
        }
      } catch (error) {
        console.error('Failed to fetch Shopify orders:', error)
        setOrders([])
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [workItem.shopify_order_id, workItem.design_fee_order_id, workItem.shopify_draft_order_id, workItem.shopify_customer_id, workItem.customer_email])

  const getFinancialStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'refunded':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    }
  }

  const getFulfillmentStatusColor = (status: string | null) => {
    if (!status) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'

    switch (status.toLowerCase()) {
      case 'fulfilled':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'partial':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    }
  }

  const getOrderType = (orderId: string) => {
    if (orderId === workItem.design_fee_order_id) return 'Design Fee'
    if (orderId === workItem.shopify_draft_order_id) return 'Production (Draft)'
    if (orderId === workItem.shopify_order_id) return 'Production'
    return 'Customer Order'
  }

  const getOrderTypeColor = (orderId: string) => {
    if (orderId === workItem.design_fee_order_id) return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    if (orderId === workItem.shopify_draft_order_id) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Shopify Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading Shopify orders...</div>
        </CardContent>
      </Card>
    )
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Shopify Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/50">
            <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">No Shopify Orders</p>
              <p className="text-xs text-muted-foreground">
                Create an invoice to generate the first order for this customer.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calculate totals
  const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total_price), 0)
  const paidOrders = orders.filter(o => o.financial_status === 'paid')
  const totalPaid = paidOrders.reduce((sum, order) => sum + parseFloat(order.total_price), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" />
          Shopify Orders
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Revenue Overview */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Package className="h-3 w-3" />
              Total Orders
            </div>
            <div className="text-2xl font-bold">
              {orders.length}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              Total Revenue
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              ${totalRevenue.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" />
              Paid
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              ${totalPaid.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        </div>

        {/* Order List */}
        <div className="space-y-3 border-t pt-4">
          <h4 className="text-sm font-semibold">Order History</h4>
          <div className="space-y-2">
            {orders.map((order) => (
              <div
                key={order.id}
                className="border rounded-lg p-4 space-y-3 bg-background hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={getOrderTypeColor(order.id.toString())} variant="secondary">
                      {getOrderType(order.id.toString())}
                    </Badge>
                    <a
                      href={`https://admin.shopify.com/store/gayfanclub/orders/${order.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                    >
                      {order.name}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={getFinancialStatusColor(order.financial_status)}>
                      {order.financial_status === 'paid' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {order.financial_status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                      {order.financial_status}
                    </Badge>
                    {order.fulfillment_status && (
                      <Badge className={getFulfillmentStatusColor(order.fulfillment_status)}>
                        {order.fulfillment_status}
                      </Badge>
                    )}
                    {!order.fulfillment_status && (
                      <Badge variant="outline" className="text-xs">
                        Not Fulfilled
                      </Badge>
                    )}
                  </div>
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">
                    ${parseFloat(order.total_price).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>

                {/* Line Items */}
                {order.line_items && order.line_items.length > 0 && (
                  <div className="border-t pt-2 space-y-1">
                    {order.line_items.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {item.quantity}x {item.title}
                        </span>
                        <span>${parseFloat(item.price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
